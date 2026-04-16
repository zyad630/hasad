import time
from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import OperationalError, transaction
from django.db.models import F

from .models import Sale, SaleItem
from inventory.models import ShipmentItem
from finance.services import LedgerService


class SaleService:
    @staticmethod
    def create_sale(
        tenant,
        user,
        items_data,
        payment_type,
        currency_code='ILS',
        exchange_rate=1,
        customer=None,
        customer_id=None,
        discount=0,
        sale_date=None,
    ):
        last_error = None
        for attempt in range(3):
            try:
                with transaction.atomic():
                    return SaleService._create_sale_once(
                        tenant=tenant,
                        user=user,
                        items_data=items_data,
                        payment_type=payment_type,
                        currency_code=currency_code,
                        exchange_rate=exchange_rate,
                        customer=customer,
                        customer_id=customer_id,
                        discount=discount,
                        sale_date=sale_date,
                    )
            except OperationalError as exc:
                last_error = exc
                if 'locked' not in str(exc).lower() or attempt == 2:
                    raise
                time.sleep(0.05 * (attempt + 1))

        raise last_error

    @staticmethod
    def _create_sale_once(
        tenant,
        user,
        items_data,
        payment_type,
        currency_code='ILS',
        exchange_rate=1,
        customer=None,
        customer_id=None,
        discount=0,
        sale_date=None,
    ):
        """Accept either customer object or customer_id for flexibility."""
        if customer is not None and customer_id is None:
            customer_id = customer.id if hasattr(customer, 'id') else customer

        validated = []
        total_discount = Decimal(str(discount or 0))

        for item_data in items_data:
            si_id = item_data.get('shipment_item_id') or (
                item_data['shipment_item'].pk
                if hasattr(item_data.get('shipment_item'), 'pk')
                else item_data.get('shipment_item')
            )
            try:
                shipment_item = ShipmentItem.objects.get(
                    id=si_id,
                    shipment__tenant=tenant,
                    shipment__status='open',
                )
            except ShipmentItem.DoesNotExist:
                raise ValidationError('Shipment item was not found or its shipment is not open.')

            qty = Decimal(str(item_data['quantity']))
            price = Decimal(str(item_data['unit_price']))

            if qty <= Decimal('0'):
                raise ValidationError({'quantity': 'Quantity must be greater than zero.'})

            subtotal = (qty * price).quantize(Decimal('0.001'), ROUND_HALF_UP)
            validated.append({
                'shipment_item': shipment_item,
                'qty': qty,
                'unit_price': price,
                'subtotal': subtotal,
                'commission_rate': Decimal(str(item_data.get('commission_rate', 0))),
                'buyer_commission_rate': Decimal(str(item_data.get('buyer_commission_rate', 0))),
                'discount': Decimal(str(item_data.get('discount', 0))),
                'gross_weight': Decimal(str(item_data.get('gross_weight', 0))),
                'net_weight': Decimal(str(item_data.get('net_weight', item_data.get('quantity', 0)))),
                'containers_out': int(item_data.get('containers_out', 0) or 0),
                'loading_fee': Decimal(str(item_data.get('loading_fee', 0))),
                'unloading_fee': Decimal(str(item_data.get('unloading_fee', 0))),
                'floor_fee': Decimal(str(item_data.get('floor_fee', 0))),
                'delivery_fee': Decimal(str(item_data.get('delivery_fee', 0))),
            })

        total_subtotal = Decimal('0')
        total_commission = Decimal('0')
        for item in validated:
            total_subtotal += item['subtotal']
            # We use buyer_commission_rate for the sale total!
            total_commission += (
                item['subtotal'] * (item['buyer_commission_rate'] / Decimal('100'))
            ).quantize(Decimal('0.001'), ROUND_HALF_UP)

        foreign_amount = (total_subtotal + total_commission - total_discount).quantize(
            Decimal('0.001'),
            ROUND_HALF_UP,
        )
        xr = Decimal(str(exchange_rate))
        base_amount = (foreign_amount * xr).quantize(Decimal('0.001'), ROUND_HALF_UP)

        sale_args = {
            'tenant': tenant,
            'customer_id': customer_id,
            'payment_type': payment_type,
            'created_by': user,
            'currency_code': currency_code,
            'exchange_rate': xr,
            'foreign_amount': foreign_amount,
            'base_amount': base_amount,
        }
        if sale_date:
            sale_args['sale_date'] = sale_date

        sale = Sale.objects.create(**sale_args)

        for item in validated:
            SaleItem.objects.create(
                sale=sale,
                shipment_item=item['shipment_item'],
                quantity=item['qty'],
                unit_price=item['unit_price'] if 'unit_price' in item else item.get('unit_price', 0),
                subtotal=item['subtotal'],
                commission_rate=item['commission_rate'],
                buyer_commission_rate=item['buyer_commission_rate'],
                discount=item['discount'],
                gross_weight=item['gross_weight'],
                net_weight=item['net_weight'],
                containers_out=item['containers_out'],
                loading_fee=item['loading_fee'],
                unloading_fee=item['unloading_fee'],
                floor_fee=item['floor_fee'],
                delivery_fee=item['delivery_fee'],
            )
            if hasattr(item['shipment_item'], 'remaining_qty'):
                updated = ShipmentItem.objects.filter(
                    pk=item['shipment_item'].pk
                ).update(remaining_qty=F('remaining_qty') - item['qty'])
                if updated != 1:
                    raise ValidationError({'quantity': 'Failed to update remaining quantity.'})

        if payment_type == 'credit' and customer_id:
            from suppliers.models import Customer

            Customer.objects.filter(pk=customer_id).update(
                credit_balance=F('credit_balance') + sale.base_amount
            )

        LedgerService.record_sale(sale)
        return sale
