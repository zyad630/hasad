from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum
from core.permissions import IsManagerOrOwner, IsSuperAdmin, IsCashierOrAbove
from rest_framework.permissions import IsAuthenticated

from .models import Settlement, Expense, CashTransaction
from .serializers import SettlementSerializer, ExpenseSerializer, CashTransactionSerializer, SettleShipmentSerializer
from inventory.models import Shipment
from .services import SettlementService

class SettlementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SettlementSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['supplier', 'is_paid']
    ordering_fields = ['settled_at']

    def get_queryset(self):
        return Settlement.objects.filter(tenant=self.request.tenant).select_related('supplier', 'shipment')

    def get_permissions(self):
        if self.action in ['confirm', 'create']:
            return [IsAuthenticated(), IsManagerOrOwner()]
        if self.action in ['list', 'retrieve', 'calculate']:
            return [IsAuthenticated(), IsCashierOrAbove()]
        return [IsAuthenticated(), IsManagerOrOwner()]

    @action(
        detail=False,
        methods=['post'],
        url_path='calculate',
        permission_classes=[IsAuthenticated, IsCashierOrAbove]
    )
    def calculate(self, request):
        shipment_id = request.data.get('shipment_id')
        if not shipment_id:
            return Response(
                {'error': 'shipment_id مطلوب'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            shipment = Shipment.objects.get(
                pk=shipment_id,
                tenant=request.tenant,
                status='open'
            )
        except Shipment.DoesNotExist:
            return Response(
                {'error': 'الإرسالية غير موجودة أو مغلقة'},
                status=status.HTTP_404_NOT_FOUND
            )
        service = SettlementService(shipment)
        return Response(service.calculate())

    @action(
        detail=False,
        methods=['post'],
        url_path='confirm',
        permission_classes=[IsAuthenticated, IsManagerOrOwner]
    )
    def confirm(self, request):
        shipment_id = request.data.get('shipment_id')
        if not shipment_id:
            return Response(
                {'error': 'shipment_id مطلوب'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            shipment = Shipment.objects.get(
                pk=shipment_id,
                tenant=request.tenant
            )
        except Shipment.DoesNotExist:
            return Response(
                {'error': 'الإرسالية غير موجودة'},
                status=status.HTTP_404_NOT_FOUND
            )
        try:
            service = SettlementService(shipment)
            settlement = service.confirm(user=request.user, request=request)
            return Response(
                SettlementSerializer(settlement).data,
                status=status.HTTP_201_CREATED
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {'error': 'خطأ داخلي — تم تسجيل المشكلة'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], url_path='mark-paid', permission_classes=[IsAuthenticated, IsManagerOrOwner])
    def mark_paid(self, request, pk=None):
        settlement = self.get_object()
        settlement.is_paid = True
        settlement.save()
        return Response(SettlementSerializer(settlement).data)
