from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Q
from rest_framework.permissions import IsAuthenticated

from core.permissions import IsManagerOrOwner, IsSuperAdmin, IsCashierOrAbove
from .models import Settlement, Expense, CashTransaction, AccountGroup, Account, Partner
from .serializers import (
    SettlementSerializer, ExpenseSerializer, CashTransactionSerializer, 
    SettleShipmentSerializer, AccountGroupSerializer, AccountSerializer, PartnerSerializer
)
from inventory.models import Shipment

class PartnerViewSet(viewsets.ModelViewSet):
    serializer_class = PartnerSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']
    permission_classes = [IsAuthenticated, IsManagerOrOwner]

    def get_queryset(self):
        return Partner.objects.filter(tenant=self.request.tenant)

    def perform_create(self, serializer):
        partner = serializer.save(tenant=self.request.tenant)
        from .services import LedgerService
        LedgerService.record_partner_initial_capital(partner, user=self.request.user)

    @action(detail=True, methods=['get'], url_path='account-statement')
    def account_statement(self, request, pk=None):
        partner = self.get_object()
        from .models import LedgerEntry
        from decimal import Decimal
        
        qs = LedgerEntry.objects.filter(
            tenant=request.tenant,
            account_type='partner',
            account_id=partner.id
        ).order_by('entry_date')

        entries = []
        running_balance = Decimal('0')
        for e in qs:
            val = e.foreign_amount if e.entry_type == LedgerEntry.DEBIT else -e.foreign_amount
            running_balance += val
            entries.append({
                'date': e.entry_date,
                'type': e.entry_type,
                'foreign_amount': float(e.foreign_amount),
                'balance': float(running_balance),
                'description': e.description,
                'reference': str(e.reference_id)
            })

        return Response({
            'partner_name': partner.name,
            'current_balance': float(running_balance),
            'entries': entries
        })

class AccountGroupViewSet(viewsets.ModelViewSet):
    serializer_class = AccountGroupSerializer
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'code']
    filterset_fields = ['account_type', 'parent']
    permission_classes = [IsAuthenticated, IsManagerOrOwner]

    def get_queryset(self):
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

    @action(detail=False, methods=['post'], url_path='calculate')
    def calculate(self, request):
        shipment_id = request.data.get('shipment_id')
        if not shipment_id:
            return Response({'error': 'shipment_id مطلوب'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            shipment = Shipment.objects.get(pk=shipment_id, tenant=request.tenant, status='open')
        except Shipment.DoesNotExist:
            return Response({'error': 'الإرسالية غير موجودة أو مغلقة'}, status=status.HTTP_404_NOT_FOUND)
            
        from .services import SettlementService
        service = SettlementService(shipment)
        return Response(service.calculate())

    @action(detail=False, methods=['post'], url_path='confirm')
    def confirm(self, request):
        shipment_id = request.data.get('shipment_id')
        if not shipment_id:
            return Response({'error': 'shipment_id مطلوب'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            shipment = Shipment.objects.get(pk=shipment_id, tenant=request.tenant)
        except Shipment.DoesNotExist:
            return Response({'error': 'الإرسالية غير موجودة'}, status=status.HTTP_404_NOT_FOUND)
            
        from .services import SettlementService
        try:
            service = SettlementService(shipment)
            settlement = service.confirm(user=request.user, request=request)
            return Response(SettlementSerializer(settlement).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': 'خطأ داخلي'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
        from django.db import transaction
        from decimal import Decimal
        from .models import Check, Account, Partner
        from .services import LedgerService
        from suppliers.models import Customer, Supplier
        
        data = request.data
        entries = data.get('entries', [])
        tx_type = data.get('tx_type', 'in') # 'in' (Receipt) or 'out' (Payment)
        currency_code = data.get('currency_code', 'ILS')
        exchange_rate = Decimal(str(data.get('exchange_rate', 1)))
        description = data.get('description', '')
        received_from = data.get('received_from', '')
        
        if not entries:
            return Response({'error': 'يجب إضافة سطر واحد على الأقل'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            with transaction.atomic():
                prefix = 'RC' if tx_type == 'in' else 'PY'
                import random
                voucher_num = f"{prefix}-{random.randint(1000, 9999)}" 
                
                for entry in entries:
                    amt_val = entry.get('amount') or entry.get('debit') or entry.get('credit')
                    if not amt_val: continue
                    amt = Decimal(str(amt_val))
                    if amt == 0: continue
                    
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
                            base_amount=round(amt * exchange_rate, 3),
                            drawer_name=received_from or description
                        )
                    
                    tx = CashTransaction.objects.create(
                        tenant=request.tenant,
                        tx_type=tx_type,
                        exchange_rate=exchange_rate,
                        currency_code=currency_code,
                        foreign_amount=amt,
                        base_amount=round(amt * exchange_rate, 3),
                        is_check=is_check,
                        check_ref=check_obj,
                        description=f"{description} - {received_from}",
                        reference_type='voucher', 
                    )

                    # ── Ledger Posting for EACH entry ──
                    acc_id = entry.get('account_id')
                    target_type = 'general'
                    target_uuid = request.tenant.id # Use tenant ID as fallback
                    target_name = "حساب عام"

                    # 1. Resolve Account Type and UUID
                    # Check if it's a specific ledger account
                    try:
                        acc = Account.objects.get(Q(id=acc_id) if len(str(acc_id)) > 30 else Q(code=acc_id), tenant=request.tenant)
                        target_type = acc.group.account_type
                        target_uuid = acc.id
                        target_name = acc.name
                    except:
                        # Try searching by name in partners/customers/suppliers if it's not a direct account
                        # (Usually account_id in the frontend will be the code or UUID)
                        pass

                    # 2. Determine DR/CR based on tx_type
                    # In Receipt (IN): Cash (Asset) is DR, Account is CR
                    # In Payment (OUT): Account is DR, Cash (Asset) is CR
                    
                    cash_account_type = 'checks_wallet' if is_check else 'cash'
                    
                    if tx_type == 'in':
                        dr_type, dr_id = cash_account_type, request.tenant.id
                        cr_type, cr_id = target_type, target_uuid
                    else:
                        dr_type, dr_id = target_type, target_uuid
                        cr_type, cr_id = cash_account_type, request.tenant.id

                    LedgerService._double_entry(
                        tenant=request.tenant,
                        dr_type=dr_type, dr_id=dr_id,
                        cr_type=cr_type, cr_id=cr_id,
                        amount=amt,
                        currency_code=currency_code,
                        exchange_rate=exchange_rate,
                        ref_type='voucher_entry',
                        ref_id=tx.id,
                        description=f"{voucher_num}: {description} | {target_name}",
                        user=request.user
                    )

                try:
                    from core.audit import log as audit_log
                    audit_log(
                        tenant=request.tenant, user=request.user,
                        action='voucher_created',
                        entity_type='Voucher', entity_id=tx.id, # Using last tx as ref
                        after={'voucher_num': voucher_num, 'tx_type': tx_type, 'entries_count': len(entries)},
                        request=request,
                        notes=f'سند {prefix}: {description} بقيمة إجمالية (طالع القيود)'
                    )
                except:
                    pass

                return Response({'message': 'تم حفظ السند وترحيله بنجاح', 'voucher_number': voucher_num}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='balance')
    def balance(self, request):
        from core.models import Currency
        results = []
        for cur in Currency.objects.filter(tenant=request.tenant):
            agg = CashTransaction.objects.filter(tenant=request.tenant, currency_code=cur.code).aggregate(
                total_in=Sum('foreign_amount', filter=Q(tx_type='in')),
                total_out=Sum('foreign_amount', filter=Q(tx_type='out')),
            )
            tin, tout = agg['total_in'] or 0, agg['total_out'] or 0
            results.append({
                'currency_code': cur.code,
                'balance':   str(round(tin - tout, 2)),
                'total_in':  str(round(tin, 2)),
                'total_out': str(round(tout, 2)),
            })
        return Response({'balances': results})

    @action(detail=False, methods=['get'], url_path='uncleared-checks')
    def uncleared_checks(self, request):
        checks = Check.objects.filter(tenant=request.tenant, status='pending').values(
            'id', 'check_number', 'bank_name', 'foreign_amount', 'due_date', 'currency_code'
        )
        return Response({'checks': list(checks)})
