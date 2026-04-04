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
    def create_sale(tenant, user, items_data, payment_type, customer_id):
        validated = []

        for item_data in items_data:
            # Lock the row — no other transaction can read/write until this one commits
            try:
                shipment_item = ShipmentItem.objects.select_for_update(nowait=False).get(
                    id=item_data['shipment_item_id'],
                    shipment__tenant=tenant,
                    shipment__is_closed=False  # assuming this is the open status flag
                )
            except ShipmentItem.DoesNotExist:
                raise ValidationError("Shipment item not found or is closed.")

            qty   = Decimal(str(item_data['quantity']))
            price = Decimal(str(item_data['unit_price']))

            if qty <= Decimal('0'):
                raise ValidationError({'quantity': 'الكمية يجب أن تكون أكبر من الصفر'})

            if getattr(shipment_item, 'remaining_qty', qty) < qty:
                raise ValidationError({
                    'quantity': f'المتوفر {shipment_item.remaining_qty} فقط'
                })

            subtotal = (qty * price).quantize(Decimal('0.01'), ROUND_HALF_UP)
            validated.append((shipment_item, qty, subtotal))

        # All validation passed — now write
        sale = Sale.objects.create(
            tenant=tenant, 
            customer_id=customer_id,
            payment_type=payment_type, 
            created_by=user,
            total_amount=sum(s for _, _, s in validated).quantize(Decimal('0.01'), ROUND_HALF_UP),
        )

        for shipment_item, qty, subtotal in validated:
            SaleItem.objects.create(
                sale=sale, 
                shipment_item=shipment_item,
                quantity=qty, 
                unit_price=subtotal/qty,
                subtotal=subtotal
            )
            if hasattr(shipment_item, 'remaining_qty'):
                ShipmentItem.objects.filter(pk=shipment_item.pk).update(
                    remaining_qty=F('remaining_qty') - qty  # atomic DB-level update
                )

        # Verify no remaining_qty went negative (final safety check)
        # Using a list comprehension safely
        ids = [s.pk for s, _, _ in validated if hasattr(s, 'remaining_qty')]
        if ids and ShipmentItem.objects.filter(pk__in=ids, remaining_qty__lt=0).exists():
            raise IntegrityError("CRITICAL: remaining_qty went negative — transaction rolled back")

        # Create Ledger Entries
        LedgerService.record_sale(sale)
        
        return sale
