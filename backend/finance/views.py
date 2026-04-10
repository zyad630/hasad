from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum

from core.permissions import IsManagerOrOwner, IsSuperAdmin, IsCashierOrAbove
from rest_framework.permissions import IsAuthenticated

from .models import Settlement, Expense, CashTransaction, AccountGroup, Account
from .serializers import SettlementSerializer, ExpenseSerializer, CashTransactionSerializer, SettleShipmentSerializer, AccountGroupSerializer, AccountSerializer
from inventory.models import Shipment

class AccountGroupViewSet(viewsets.ModelViewSet):
    serializer_class = AccountGroupSerializer
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'code']
    filterset_fields = ['account_type', 'parent']
    permission_classes = [IsAuthenticated, IsManagerOrOwner]

    def get_queryset(self):
        # By default, maybe return only top-level groups (parent=None) to build a tree
        qs = AccountGroup.objects.filter(tenant=self.request.tenant)
        tree = self.request.query_params.get('tree', 'false').lower() == 'true'
        if tree:
            return qs.filter(parent__isnull=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)

class AccountViewSet(viewsets.ModelViewSet):
    serializer_class = AccountSerializer
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'code']
    filterset_fields = ['group', 'is_active']
    permission_classes = [IsAuthenticated, IsManagerOrOwner]

    def get_queryset(self):
        return Account.objects.filter(tenant=self.request.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)


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
    filterset_fields = ['shipment', 'expense_date']
    ordering_fields = ['expense_date', 'base_amount']

    def get_queryset(self):
        return Expense.objects.filter(tenant=self.request.tenant)

    def perform_create(self, serializer):
        expense = serializer.save(tenant=self.request.tenant)
        from .services import LedgerService
        LedgerService.record_general_expense(expense, user=self.request.user)


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
        Creates multiple cash/check transactions and updates the Ledger.
        Data: {
            'tx_type': 'in' (Receipt) or 'out' (Payment),
            'target_type': 'customer' or 'supplier',
            'target_id': '...',
            'currency_code': 'ILS',
            'description': '...',
            'entries': [
                {'type': 'cash', 'amount': 100},
                {'type': 'check', 'amount': 200, ...}
            ]
        }
        """
        from django.db import transaction
        from .models import Check
        from .services import LedgerService
        from core.models import DocumentSequence
        from suppliers.models import Customer, Supplier
        
        data = request.data
        entries = data.get('entries', [])
        tx_type = data.get('tx_type', 'in')
        target_type = data.get('target_type') # 'customer' or 'supplier'
        target_id = data.get('target_id')
        currency_code = data.get('currency_code', 'ILS')
        exchange_rate = data.get('exchange_rate', 1)
        description = data.get('description', '')
        
        if not entries:
            return Response({'error': 'يجب إضافة سطر واحد على الأقل'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            with transaction.atomic():
                prefix = 'RC' if tx_type == 'in' else 'PY'
                import random
                voucher_num = f"{prefix}-{random.randint(1000, 9999)}" 
                
                total_amount = 0
                created_items = []
                
                for entry in entries:
                    amt = entry.get('amount', 0)
                    total_amount += float(amt)
                    is_check = entry.get('type') == 'check'
                    check_obj = None
                    
                    if is_check:
                        check_obj = Check.objects.create(
                            tenant=request.tenant,
                            check_number=entry.get('check_number'),
                            bank_name=entry.get('bank_name'),
                            due_date=entry.get('due_date'),
                            currency_code=currency_code,
                            foreign_amount=amt,
                            exchange_rate=exchange_rate,
                            base_amount=round(float(amt) * float(exchange_rate), 3),
                            drawer_name=data.get('received_from') or description
                        )
                    
                    tx = CashTransaction.objects.create(
                        tenant=request.tenant,
                        tx_type=tx_type,
                        exchange_rate=exchange_rate,
                        currency_code=currency_code,
                        foreign_amount=amt,
                        base_amount=round(float(amt) * float(exchange_rate), 3),
                        is_check=is_check,
                        check_ref=check_obj,
                        description=f"{description}",
                        reference_type=f"{target_type}_voucher" if target_type else 'manual',
                        reference_id=target_id
                    )
                    created_items.append(tx)

                # ── CORE CONNECTIVITY: Update the Ledger ──
                if target_type == 'customer' and target_id:
                    customer = Customer.objects.get(id=target_id, tenant=request.tenant)
                    if tx_type == 'in': # Customer paying us
                        LedgerService.record_customer_collection(request.tenant, customer, total_amount, user=request.user, reference_id=tx.id, currency_code=currency_code)
                    else: # We paying customer (return/refund)
                         LedgerService._double_entry(
                            tenant=request.tenant, dr_type='customer', dr_id=customer.id,
                            cr_type='cash', cr_id=request.tenant.id, amount=total_amount,
                            currency_code=currency_code, exchange_rate=exchange_rate,
                            ref_type='customer_refund', ref_id=tx.id, description=f"رد مبلغ للعميل: {customer.name}",
                            user=request.user
                        )
                
                elif target_type == 'supplier' and target_id:
                    supplier = Supplier.objects.get(id=target_id, tenant=request.tenant)
                    if tx_type == 'out': # Paying supplier
                        LedgerService.record_supplier_payment(request.tenant, supplier, total_amount, user=request.user, reference_id=tx.id, currency_code=currency_code)
                    else: # Supplier paying us (refund/credit)
                        LedgerService._double_entry(
                            tenant=request.tenant, dr_type='cash', dr_id=request.tenant.id,
                            cr_type='supplier', cr_id=supplier.id, amount=total_amount,
                            currency_code=currency_code, exchange_rate=exchange_rate,
                            ref_type='supplier_refund', ref_id=tx.id, description=f"استرداد من المورد: {supplier.name}",
                            user=request.user
                        )

                return Response({'message': 'تم حفظ السند وترحيله للحسابات بنجاح', 'voucher_number': voucher_num}, status=status.HTTP_201_CREATED)
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
                total_in=Sum('foreign_amount', filter=__import__('django.db.models', fromlist=['Q']).Q(tx_type='in')),
                total_out=Sum('foreign_amount', filter=__import__('django.db.models', fromlist=['Q']).Q(tx_type='out')),
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

    @action(detail=False, methods=['get'], url_path='uncleared-checks')
    def uncleared_checks(self, request):
        from .models import Check
        checks = Check.objects.filter(tenant=request.tenant, status='pending').values(
            'id', 'check_number', 'bank_name', 'foreign_amount', 'due_date', 'currency_code'
        )
        return Response({'checks': list(checks)})
