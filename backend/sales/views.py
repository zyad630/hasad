from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import F
from django.utils import timezone
from django.db import transaction
from decimal import Decimal

from core.permissions import IsManagerOrOwner, IsCashierOrAbove
from .models import Sale, SaleItem, ContainerTransaction
from .serializers import SaleSerializer, ContainerTransactionSerializer


class SaleViewSet(viewsets.ModelViewSet):
    serializer_class    = SaleSerializer
    filter_backends     = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields    = ['customer', 'payment_type', 'is_cancelled']
    ordering_fields     = ['sale_date', 'foreign_amount']
    search_fields       = ['customer__name', 'id']
    # REQUIREMENT 1: Allow GET, POST, and PATCH for post-posting edits
    # DELETE is still blocked (immutable ledger — use cancel instead)
    http_method_names   = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        return (
            Sale.objects
            .filter(tenant=self.request.tenant)
            .select_related('customer', 'created_by')
            .prefetch_related('items__shipment_item__item')
        )

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['tenant'] = self.request.tenant
        return ctx

    @action(detail=True, methods=['get'])
    def receipt(self, request, pk=None):
        """Returns full invoice data suitable for printing."""
        sale = self.get_object()
        data = self.get_serializer(sale).data
        # Enrich with totals for print layout
        items = sale.items.select_related('shipment_item__item').all()
        data['items_detail'] = [{
            'item_name':       si.shipment_item.item.name,
            'quantity':        str(si.quantity),
            'unit_price':      str(si.unit_price),
            'subtotal':        str(si.subtotal),
            'commission_rate': str(si.commission_rate),
            'discount':        str(si.discount),
            'gross_weight':    str(si.gross_weight),
            'net_weight':      str(si.net_weight),
        } for si in items]
        return Response(data)

    @action(detail=True, methods=['get'], url_path='full-detail')
    def full_detail(self, request, pk=None):
        """Full invoice detail with supplier/farmer info for each line."""
        sale = self.get_object()
        data = self.get_serializer(sale).data
        items = sale.items.select_related(
            'shipment_item__item',
            'shipment_item__shipment__supplier'
        ).all()
        data['lines'] = [{
            'id':              str(si.id),
            'shipment_item':   str(si.shipment_item.id),
            'item_name':       si.shipment_item.item.name,
            'supplier_name':   si.shipment_item.shipment.supplier.name,
            'quantity':        str(si.quantity),
            'unit_price':      str(si.unit_price),
            'gross_weight':    str(si.gross_weight),
            'net_weight':      str(si.net_weight),
            'subtotal':        str(si.subtotal),
            'commission_rate': str(si.commission_rate),
            'discount':        str(si.discount),
            'containers_out':  si.containers_out,
        } for si in items]
        data['cancelled'] = sale.is_cancelled
        data['cancel_reason'] = sale.cancel_reason
        return Response(data)

    @action(detail=True, methods=['patch'], url_path='edit',
            permission_classes=[IsAuthenticated, IsManagerOrOwner])
    @transaction.atomic
    def edit_posted(self, request, pk=None):
        """
        REQUIREMENT 1: Edit a posted invoice.
        Strategy: Soft-cancel original ledger via reversal, restore inventory,
        then create corrected SaleItems and re-post.
        Only allowed if the shipment is still open (not settled).
        """
        from finance.services import LedgerService
        from inventory.models import ShipmentItem

        sale = self.get_object()
        if sale.is_cancelled:
            return Response({'error': 'الفاتورة ملغاة ولا يمكن تعديلها'}, status=400)

        # Check: shipment must be open (not settled)
        for item in sale.items.all():
            if item.shipment_item.shipment.status == 'settled':
                return Response(
                    {'error': f'الإرسالية للصنف {item.shipment_item.item.name} مصفّاة — لا يمكن التعديل بعد التصفية'},
                    status=400
                )

        new_items_data = request.data.get('items', [])
        new_payment_type = request.data.get('payment_type', sale.payment_type)
        new_customer_id  = request.data.get('customer', sale.customer_id)
        reason = request.data.get('reason', 'تعديل فاتورة')

        if not new_items_data:
            return Response({'error': 'يجب تقديم بنود الفاتورة المعدّلة'}, status=400)

        # 1. Reverse ledger entries for the original sale
        LedgerService.record_sale_reversal(sale, user=request.user)

        # 2. Restore inventory for all original items
        for item in sale.items.all():
            ShipmentItem.objects.filter(pk=item.shipment_item.pk).update(
                remaining_qty=F('remaining_qty') + item.quantity
            )

        # 3. Delete old SaleItems (not the Sale record itself)
        sale.items.all().delete()

        # 4. Recalculate and create new items
        from .services import SaleService
        currency_code = request.data.get('currency_code', sale.currency_code)
        exchange_rate = Decimal(str(request.data.get('exchange_rate', sale.exchange_rate)))

        total_subtotal   = Decimal('0')
        total_commission = Decimal('0')
        total_discount   = Decimal(str(request.data.get('discount', 0)))
        new_item_objects = []

        for item_data in new_items_data:
            si_id = item_data.get('shipment_item')
            try:
                shipment_item = ShipmentItem.objects.select_for_update().get(
                    id=si_id, shipment__tenant=request.tenant, shipment__status='open'
                )
            except ShipmentItem.DoesNotExist:
                return Response({'error': f'بند الإرسالية {si_id} غير موجود'}, status=400)

            qty        = Decimal(str(item_data['quantity']))
            unit_price = Decimal(str(item_data['unit_price']))
            comm_rate  = Decimal(str(item_data.get('commission_rate', 0)))
            disc       = Decimal(str(item_data.get('discount', 0)))

            if qty > shipment_item.remaining_qty:
                return Response({'error': f'المتوفر من {shipment_item.item.name}: {shipment_item.remaining_qty}'}, status=400)

            subtotal = (qty * unit_price).quantize(Decimal('0.001'))
            total_subtotal   += subtotal
            total_commission += (subtotal * comm_rate / 100).quantize(Decimal('0.001'))

            new_item_objects.append({
                'shipment_item': shipment_item, 'qty': qty,
                'unit_price': unit_price, 'subtotal': subtotal,
                'commission_rate': comm_rate, 'discount': disc,
                'gross_weight': Decimal(str(item_data.get('gross_weight', 0))),
                'net_weight':   Decimal(str(item_data.get('net_weight', qty))),
                'containers_out': int(item_data.get('containers_out', 0)),
            })

        foreign_amount = (total_subtotal + total_commission - total_discount).quantize(Decimal('0.001'))
        base_amount    = (foreign_amount * exchange_rate).quantize(Decimal('0.001'))

        # 5. Update the Sale header
        sale.payment_type   = new_payment_type
        sale.customer_id    = new_customer_id
        sale.currency_code  = currency_code
        sale.exchange_rate  = exchange_rate
        sale.foreign_amount = foreign_amount
        sale.base_amount    = base_amount
        sale.save(update_fields=['payment_type','customer_id','currency_code',
                                 'exchange_rate','foreign_amount','base_amount'])

        # 6. Create new SaleItems and deduct inventory
        for obj in new_item_objects:
            SaleItem.objects.create(
                sale=sale,
                shipment_item=obj['shipment_item'],
                quantity=obj['qty'],
                unit_price=obj['unit_price'],
                subtotal=obj['subtotal'],
                commission_rate=obj['commission_rate'],
                discount=obj['discount'],
                gross_weight=obj['gross_weight'],
                net_weight=obj['net_weight'],
                containers_out=obj['containers_out'],
            )
            ShipmentItem.objects.filter(pk=obj['shipment_item'].pk).update(
                remaining_qty=F('remaining_qty') - obj['qty']
            )

        # 7. Re-post corrected ledger entries
        LedgerService.record_sale(sale)

        # 8. Audit log
        try:
            from core.audit import log as audit_log
            audit_log(
                tenant=request.tenant, user=request.user,
                action='sale_edited',
                entity_type='Sale', entity_id=sale.id,
                before={'items_count': len(new_items_data)},
                after={'new_total': str(foreign_amount), 'reason': reason},
                request=request,
            )
        except Exception:
            pass

        return Response(self.get_serializer(sale).data)

    # H-01: Cancel action — immutable trail instead of delete
    @action(
        detail=True,
        methods=['post'],
        url_path='cancel',
        permission_classes=[IsAuthenticated, IsManagerOrOwner]
    )
    def cancel(self, request, pk=None):
        sale = self.get_object()

        if sale.is_cancelled:
            return Response(
                {'error': 'هذه الفاتورة ملغاة مسبقاً'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {'error': 'سبب الإلغاء مطلوب'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from finance.services import LedgerService

        # Restore inventory quantities for each item
        for item in sale.items.all():
            item.shipment_item.__class__.objects.filter(
                pk=item.shipment_item.pk
            ).update(remaining_qty=F('remaining_qty') + item.quantity)

        # Write reversal ledger entries
        LedgerService.record_sale_reversal(sale, user=request.user)

        # Soft-cancel — never hard delete
        sale.is_cancelled = True
        sale.cancelled_at = timezone.now()
        sale.cancelled_by = request.user
        sale.cancel_reason = reason
        sale.save(update_fields=[
            'is_cancelled', 'cancelled_at', 'cancelled_by', 'cancel_reason'
        ])

        try:
            from core.audit import log as audit_log
            audit_log(
                tenant=request.tenant,
                user=request.user,
                action='sale_cancelled',
                entity_type='Sale',
                entity_id=sale.id,
                before={'is_cancelled': False, 'total': str(sale.foreign_amount)},
                after={'is_cancelled': True, 'reason': reason},
                request=request,
            )
        except Exception:
            pass

        return Response({'status': 'تم الإلغاء', 'sale_id': str(sale.id)})


class ContainerTransactionViewSet(viewsets.ModelViewSet):
    serializer_class  = ContainerTransactionSerializer
    filter_backends   = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields  = ['customer', 'direction', 'container_type']
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        return ContainerTransaction.objects.filter(
            tenant=self.request.tenant
        ).select_related('customer')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)

    @action(detail=False, methods=['get'], url_path='balance')
    def customer_balance(self, request):
        from django.db.models import Sum, Case, When, IntegerField
        balances = ContainerTransaction.objects.filter(
            tenant=request.tenant
        ).values('customer__name', 'customer_id', 'container_type').annotate(
            out_total=Sum(
                Case(When(direction='out', then='quantity'), default=0, output_field=IntegerField())
            ),
            return_total=Sum(
                Case(When(direction='return', then='quantity'), default=0, output_field=IntegerField())
            ),
        )
        result = [
            {
                'customer_id':   str(b['customer_id']),
                'customer_name': b['customer__name'],
                'container_type': b['container_type'],
                'balance': b['out_total'] - b['return_total'],
            }
            for b in balances
        ]
        return Response(result)
