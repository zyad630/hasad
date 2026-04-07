from rest_framework import serializers
from .models import CommissionType, Supplier, Customer
from finance.models import LedgerEntry
from core.models import Currency


# ─── Module 1: CommissionType ────────────────────────────────────────────────

class CommissionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommissionType
        fields = ['id', 'name', 'calc_type', 'default_rate']
        read_only_fields = ['id']


# ─── Supplier ────────────────────────────────────────────────────────────────

class SupplierSerializer(serializers.ModelSerializer):
    commission_type_detail = CommissionTypeSerializer(source='commission_type', read_only=True)
    commission_rate = serializers.SerializerMethodField()
    balances = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'phone', 'deal_type',
            'commission_type', 'commission_type_detail', 'commission_rate',
            'balance', 'whatsapp_number', 'is_active', 'notes', 'balances',
        ]
        read_only_fields = ['id', 'balance']

    def get_commission_rate(self, obj):
        """Return the rate from the linked CommissionType (auto-populated)."""
        if obj.commission_type:
            return {
                'calc_type': obj.commission_type.calc_type,
                'rate': float(obj.commission_type.default_rate),
            }
        return None

    def get_balances(self, obj):
        result = []
        currencies = Currency.objects.filter(tenant=obj.tenant)
        for cur in currencies:
            balance = float(LedgerEntry.get_balance(
                tenant=obj.tenant,
                account_type='supplier',
                account_id=obj.id,
                currency_code=cur.code,
            ))
            if balance != 0:
                result.append({
                    'currency_code': cur.code,
                    'currency_name': cur.name,
                    'currency_symbol': cur.symbol,
                    'amount': balance,
                })
        return result


# ─── Customer ─────────────────────────────────────────────────────────────────

class CustomerSerializer(serializers.ModelSerializer):
    balances = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone', 'customer_type',
            'credit_balance', 'credit_limit', 'is_active', 'notes', 'balances',
        ]
        read_only_fields = ['id', 'credit_balance']

    def get_balances(self, obj):
        result = []
        currencies = Currency.objects.filter(tenant=obj.tenant)
        for cur in currencies:
            balance = float(LedgerEntry.get_balance(
                tenant=obj.tenant,
                account_type='customer',
                account_id=obj.id,
                currency_code=cur.code,
            ))
            if balance != 0:
                result.append({
                    'currency_code': cur.code,
                    'currency_name': cur.name,
                    'currency_symbol': cur.symbol,
                    'amount': balance,
                })
        return result
