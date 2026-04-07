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
            
        from .services import SettlementService
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
            
        from .services import SettlementService
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


class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['shipment', 'expense_type', 'expense_date']
    ordering_fields = ['expense_date', 'amount']

    def get_queryset(self):
        return Expense.objects.filter(tenant=self.request.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)


class CashTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = CashTransactionSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['tx_type', 'reference_type']
    ordering_fields = ['tx_date']
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        return CashTransaction.objects.filter(tenant=self.request.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)

    @action(detail=False, methods=['post'], url_path='voucher')
    def create_voucher(self, request):
        """
        Creates multiple cash/check transactions in one go.
        Expected data: {
            'tx_type': 'in'/'out',
            'currency_code': 'ILS',
            'description': '...',
            'entries': [
                {'type': 'cash', 'amount': 100},
                {'type': 'check', 'amount': 200, 'check_number': '123', 'bank_name': 'Bank X', 'due_date': '2026-06-05'}
            ]
        }
        """
        from django.db import transaction
        from .models import Check
        
        data = request.data
        entries = data.get('entries', [])
        tx_type = data.get('tx_type', 'in')
        currency_code = data.get('currency_code', 'ILS')
        description = data.get('description', '')
        
        if not entries:
            return Response({'error': 'يجب إضافة سطر واحد على الأقل'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            with transaction.atomic():
                created_items = []
                for entry in entries:
                    is_check = entry.get('type') == 'check'
                    check_obj = None
                    
                    if is_check:
                        check_obj = Check.objects.create(
                            tenant=request.tenant,
                            check_number=entry.get('check_number'),
                            bank_name=entry.get('bank_name'),
                            due_date=entry.get('due_date'),
                            amount=entry.get('amount'),
                            currency_code=currency_code,
                            drawer_name=data.get('received_from')
                        )
                    
                    tx = CashTransaction.objects.create(
                        tenant=request.tenant,
                        tx_type=tx_type,
                        currency_code=currency_code,
                        amount=entry.get('amount'),
                        is_check=is_check,
                        check_ref=check_obj,
                        description=description,
                        reference_type='voucher'
                    )
                    created_items.append(tx)
                
                return Response({'message': 'تم حفظ السند بنجاح', 'count': len(created_items)}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='balance')
    def balance(self, request):
        from decimal import Decimal, ROUND_HALF_UP
        from core.models import Currency
        
        active_currencies = Currency.objects.filter(tenant=request.tenant)
        results = []
        
        for cur in active_currencies:
            agg = CashTransaction.objects.filter(tenant=request.tenant, currency_code=cur.code).aggregate(
                total_in=Sum('amount', filter=__import__('django.db.models', fromlist=['Q']).Q(tx_type='in')),
                total_out=Sum('amount', filter=__import__('django.db.models', fromlist=['Q']).Q(tx_type='out')),
            )
            total_in = agg['total_in'] or Decimal('0.00')
            total_out = agg['total_out'] or Decimal('0.00')
            results.append({
                'currency_code': cur.code,
                'balance':   str((total_in - total_out).quantize(Decimal('0.01'), ROUND_HALF_UP)),
                'total_in':  str(total_in.quantize(Decimal('0.01'), ROUND_HALF_UP)),
                'total_out': str(total_out.quantize(Decimal('0.01'), ROUND_HALF_UP)),
            })
            
        return Response({'balances': results})
