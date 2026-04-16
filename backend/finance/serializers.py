from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from .models import Settlement, Expense, CashTransaction
from inventory.models import Shipment
from suppliers.models import Supplier, Customer
from core.models import Currency

from core.serializers import CurrencySerializerMixin

class FinanceBaseSerializer(CurrencySerializerMixin, serializers.ModelSerializer):
    # The fields are inherited from CurrencySerializerMixin
    pass

from .models import AccountGroup, Account

class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['id', 'group', 'name', 'code', 'is_active']
        read_only_fields = ['id']

class AccountGroupSerializer(serializers.ModelSerializer):
    accounts = AccountSerializer(many=True, read_only=True)
    subgroups = serializers.SerializerMethodField()

    class Meta:
        model = AccountGroup
        fields = ['id', 'name', 'code', 'parent', 'account_type', 'accounts', 'subgroups']
        read_only_fields = ['id']

    def get_subgroups(self, obj):
        # Recursively serialize subgroups
        return AccountGroupSerializer(obj.subgroups.all(), many=True).data

class ExpenseSerializer(FinanceBaseSerializer):
    class Meta:
        model = Expense
        fields = ['id', 'shipment', 'category', 'currency_code', 'currency_symbol', 'currency_name',
                  'foreign_amount', 'exchange_rate', 'base_amount', 'description', 'expense_date']
        read_only_fields = ['id']

class CashTransactionSerializer(FinanceBaseSerializer):
    class Meta:
        model = CashTransaction
        fields = ['id', 'tx_type', 'currency_code', 'exchange_rate', 'foreign_amount', 'base_amount',
                  'currency_symbol', 'currency_name', 'is_check', 'reference_type', 'reference_id',
                  'description', 'tx_date']
        read_only_fields = ['id', 'tx_date']

class SettlementSerializer(FinanceBaseSerializer):
    shipment_date = serializers.DateField(source='shipment.shipment_date', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = Settlement
        fields = ['id', 'shipment', 'shipment_date', 'supplier', 'supplier_name', 'currency_code', 'currency_symbol', 'currency_name',
                  'total_sales', 'commission_amount', 'total_expenses', 'net_supplier',
                  'is_paid', 'settled_at']
        read_only_fields = ['id', 'total_sales', 'commission_amount', 'total_expenses', 'net_supplier', 'settled_at']

class SettleShipmentSerializer(serializers.Serializer):
    """Trigger settlement calculation for a shipment."""
    shipment_id = serializers.UUIDField()

    def validate_shipment_id(self, value):
        try:
            shipment = Shipment.objects.get(pk=value)
        except Shipment.DoesNotExist:
            raise serializers.ValidationError("الإرسالية غير موجودة")
        if shipment.status == 'settled':
            raise serializers.ValidationError("هذه الإرسالية تم تصفيتها مسبقاً")
        self._shipment = shipment
        return value

    def create(self, validated_data):
        from .services import SettlementService
        shipment = self._shipment
        request = self.context.get('request')
        tenant = request.tenant if request else None
        user = request.user if request else None
        
        return SettlementService.confirm_settlement(
            tenant=tenant,
            user=user,
            shipment_id=shipment.id
        )

from .models import Partner

class PartnerSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Partner
        fields = ['id', 'name', 'phone', 'share_percentage', 'initial_capital', 'is_active', 'notes', 'balance', 'created_at']
        read_only_fields = ['id', 'created_at', 'balance']

    def get_balance(self, obj):
        from .models import LedgerEntry
        # For partners, CR (Credit) indicates their equity/capital, which should be shown as safe/positive balance
        # Since get_balance returns DR-CR, we invert it to get CR-DR
        return -float(LedgerEntry.get_balance(obj.tenant, 'partner', obj.id))

from .models import JournalVoucher


def _resolve_voucher_account(tenant, account_type, account_id):
    from .models import Partner

    tenant_scoped_types = {
        'cash', 'checks_wallet', 'bank_account', 'revenue', 'cost_of_goods',
        'commission_revenue', 'general_expense', 'salary_expense', 'forex_gain',
        'forex_loss', 'plastic_expense', 'labor_expense', 'transport_expense',
    }

    if account_type in tenant_scoped_types:
        if str(account_id) != str(tenant.id):
            raise serializers.ValidationError({
                'account_id': f'{account_type} must use the current tenant id.'
            })
        return account_type, tenant.id, account_type

    if account_type == 'partner':
        obj = Partner.objects.filter(tenant=tenant, id=account_id).first()
        if not obj:
            raise serializers.ValidationError({'account_id': 'Partner account was not found in this tenant.'})
        return 'partner', obj.id, obj.name

    if account_type == 'customer':
        obj = Customer.objects.filter(tenant=tenant, id=account_id).first()
        if not obj:
            raise serializers.ValidationError({'account_id': 'Customer account was not found in this tenant.'})
        return 'customer', obj.id, obj.name

    if account_type == 'supplier':
        obj = Supplier.objects.filter(tenant=tenant, id=account_id).first()
        if not obj:
            raise serializers.ValidationError({'account_id': 'Supplier account was not found in this tenant.'})
        return 'supplier', obj.id, obj.name

    if account_type == 'account':
        obj = Account.objects.filter(tenant=tenant, id=account_id, is_active=True).select_related('group').first()
        if not obj:
            raise serializers.ValidationError({'account_id': 'Chart account was not found in this tenant.'})
        normalized_type = obj.group.account_type
        return normalized_type, obj.id, obj.name

    raise serializers.ValidationError({'account_type': f'Unsupported account type: {account_type}'})

class JournalVoucherSerializer(FinanceBaseSerializer):
    class Meta:
        model = JournalVoucher
        fields = [
            'id', 'voucher_date', 'currency_code', 'currency_symbol', 'currency_name',
            'exchange_rate', 'amount', 'base_amount', 'description',
            'dr_account_type', 'dr_account_id', 'dr_account_name',
            'cr_account_type', 'cr_account_id', 'cr_account_name',
            'created_by'
        ]
        read_only_fields = ['id', 'voucher_date', 'base_amount', 'created_by']

    def validate(self, attrs):
        request = self.context.get('request')
        tenant = getattr(request, 'tenant', None)
        if tenant is None:
            raise serializers.ValidationError('Tenant context is required.')

        amount = Decimal(str(attrs.get('amount', 0)))
        exchange_rate = Decimal(str(attrs.get('exchange_rate', 0)))
        currency_code = attrs.get('currency_code', 'ILS')

        if amount <= 0:
            raise serializers.ValidationError({'amount': 'Amount must be greater than zero.'})
        if exchange_rate <= 0:
            raise serializers.ValidationError({'exchange_rate': 'Exchange rate must be greater than zero.'})
        if not Currency.objects.filter(tenant=tenant, code=currency_code).exists():
            raise serializers.ValidationError({'currency_code': 'Currency is not configured for this tenant.'})

        dr_type, dr_id, dr_name = _resolve_voucher_account(
            tenant,
            attrs.get('dr_account_type'),
            attrs.get('dr_account_id'),
        )
        cr_type, cr_id, cr_name = _resolve_voucher_account(
            tenant,
            attrs.get('cr_account_type'),
            attrs.get('cr_account_id'),
        )

        if str(dr_type) == str(cr_type) and str(dr_id) == str(cr_id):
            raise serializers.ValidationError('Debit and credit accounts cannot be the same.')

        attrs['dr_account_type'] = dr_type
        attrs['dr_account_id'] = dr_id
        attrs['dr_account_name'] = attrs.get('dr_account_name') or dr_name
        attrs['cr_account_type'] = cr_type
        attrs['cr_account_id'] = cr_id
        attrs['cr_account_name'] = attrs.get('cr_account_name') or cr_name
        attrs['base_amount'] = (amount * exchange_rate).quantize(Decimal('0.001'), ROUND_HALF_UP)
        return attrs

