from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError
from django.db.models import F
from .models import Sale, SaleItem
from inventory.models import ShipmentItem
from finance.services import LedgerService

class SaleService:
    @staticmethod
    @transaction.atomic
    def create_sale(tenant, user, items_data, payment_type, currency_code='ILS', exchange_rate=1, customer=None, customer_id=None, discount=0, sale_date=None):
        """Accept either customer object or customer_id for flexibility."""
        if customer is not None and customer_id is None:
            customer_id = customer.id if hasattr(customer, 'id') else customer
        validated = []

        total_discount = Decimal(str(discount or 0))

        for item_data in items_data:
            si_id = item_data.get('shipment_item_id') or (
                item_data['shipment_item'].pk if hasattr(item_data.get('shipment_item'), 'pk')
                else item_data.get('shipment_item')
            )
            try:
                shipment_item = ShipmentItem.objects.select_for_update(nowait=False).get(
                    id=si_id,
                    shipment__tenant=tenant,
                    shipment__status='open',
                )
            except ShipmentItem.DoesNotExist:
                raise ValidationError("بند الإرسالية غير موجود أو الإرسالية مغلقة.")

            qty   = Decimal(str(item_data['quantity']))
            price = Decimal(str(item_data['unit_price']))

            if qty <= Decimal('0'):
                raise ValidationError({'quantity': 'الكمية يجب أن تكون أكبر من الصفر'})

            if getattr(shipment_item, 'remaining_qty', qty) < qty:
                raise ValidationError({
                    'quantity': f'المتوفر {shipment_item.remaining_qty} فقط'
                })

            subtotal = (qty * price).quantize(Decimal('0.001'), ROUND_HALF_UP)
            
            validated.append({
                'shipment_item': shipment_item,
                'qty': qty,
                'subtotal': subtotal,
                'commission_rate': Decimal(str(item_data.get('commission_rate', 0))),
                'discount': Decimal(str(item_data.get('discount', 0))),
                'gross_weight': Decimal(str(item_data.get('gross_weight', 0))),
                'net_weight': Decimal(str(item_data.get('net_weight', item_data.get('quantity', 0)))),
                'containers_out': int(item_data.get('empties_count', 0) or 0)
            })

        # Calculate final total — 3 decimal places (BRD requirement)
        total_subtotal = Decimal('0')
        total_commission = Decimal('0')
        for v in validated:
            total_subtotal += v['subtotal']
            total_commission += (v['subtotal'] * (v['commission_rate'] / Decimal('100'))).quantize(Decimal('0.001'), ROUND_HALF_UP)
            
        # foreign_amount: invoice amount in the transaction currency
        foreign_amount = (total_subtotal + total_commission - total_discount).quantize(Decimal('0.001'), ROUND_HALF_UP)
        xr = Decimal(str(exchange_rate))
        # base_amount: equivalent in ILS (base currency)
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

        for v in validated:
            SaleItem.objects.create(
                sale=sale, 
                shipment_item=v['shipment_item'],
                quantity=v['qty'], 
                unit_price=v['subtotal']/v['qty'] if v['qty'] > 0 else 0,
                subtotal=v['subtotal'],
                commission_rate=v['commission_rate'],
                discount=v['discount'],
                gross_weight=v['gross_weight'],
                net_weight=v['net_weight'],
                containers_out=v['containers_out']
            )
            if hasattr(v['shipment_item'], 'remaining_qty'):
                ShipmentItem.objects.filter(pk=v['shipment_item'].pk).update(
                    remaining_qty=F('remaining_qty') - v['qty']
                )

        ids = [v['shipment_item'].pk for v in validated if hasattr(v['shipment_item'], 'remaining_qty')]
        if ids and ShipmentItem.objects.filter(pk__in=ids, remaining_qty__lt=0).exists():
            raise IntegrityError("CRITICAL: remaining_qty went negative")

        if payment_type == 'credit' and customer_id:
            from suppliers.models import Customer
            # Use base_amount (ILS) for credit_balance tracking
            Customer.objects.filter(pk=customer_id).update(
                credit_balance=F('credit_balance') + sale.base_amount
            )

        LedgerService.record_sale(sale)
        return sale
