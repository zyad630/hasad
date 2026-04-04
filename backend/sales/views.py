from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import F
from django.utils import timezone

from core.permissions import IsManagerOrOwner, IsCashierOrAbove
from .models import Sale, SaleItem, ContainerTransaction
from .serializers import SaleSerializer, ContainerTransactionSerializer


class SaleViewSet(viewsets.ModelViewSet):
    serializer_class    = SaleSerializer
    filter_backends     = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields    = ['customer', 'payment_type', 'is_cancelled']
    ordering_fields     = ['sale_date', 'total_amount']
    http_method_names   = ['get', 'post', 'head', 'options']   # H-01: No DELETE or PUT

    def get_queryset(self):
        return (
            Sale.objects
            .filter(tenant=self.request.user.tenant)
            .select_related('customer', 'created_by')
            .prefetch_related('items__shipment_item__item')
        )

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, created_by=self.request.user)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['tenant'] = self.request.user.tenant
        return ctx

    @action(detail=True, methods=['get'])
    def receipt(self, request, pk=None):
        sale = self.get_object()
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
                tenant=request.user.tenant,
                user=request.user,
                action='sale_cancelled',
                entity_type='Sale',
                entity_id=sale.id,
                before={'is_cancelled': False, 'total': str(sale.total_amount)},
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
            tenant=self.request.user.tenant
        ).select_related('customer')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)

    @action(detail=False, methods=['get'], url_path='balance')
    def customer_balance(self, request):
        from django.db.models import Sum, Case, When, IntegerField
        balances = ContainerTransaction.objects.filter(
            tenant=request.user.tenant
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
