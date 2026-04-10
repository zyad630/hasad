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

class SupplierSerializer(serializers.ModelSerializer):
    commission_type = serializers.CharField(write_only=True, required=False, allow_null=True)
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

    def create(self, validated_data):
        commission_label = validated_data.pop('commission_type', 'percent')
        commission_rate = validated_data.pop('commission_rate', 0)
        request = self.context.get('request')
        tenant = request.tenant if request else None
        
        # Ensure name is provided as required by model
        if not validated_data.get('name'):
            raise serializers.ValidationError({"name": "هذا الحقل مطلوب"})

        # Try to resolve a matching CommissionType or create one named "Default"
        if tenant:
            c_type, _ = CommissionType.objects.get_or_create(
                tenant=tenant,
                calc_type=commission_label if commission_label in ['percent', 'fixed'] else 'percent',
                default_rate=commission_rate,
                defaults={'name': f"عمولة {commission_rate} ({commission_label})"}
            )
            validated_data['commission_type'] = c_type
            
        return super().create(validated_data)

    def update(self, instance, validated_data):
        commission_label = validated_data.pop('commission_type', None)
        commission_rate = validated_data.pop('commission_rate', None)
        request = self.context.get('request')
        tenant = request.tenant if request else None

        if (commission_label or commission_rate is not None) and tenant:
            # Use existing values if one is missing in the partial update
            label = commission_label or (instance.commission_type.calc_type if instance.commission_type else 'percent')
            rate = commission_rate if commission_rate is not None else (instance.commission_type.default_rate if instance.commission_type else 0)
            
            c_type, _ = CommissionType.objects.get_or_create(
                tenant=tenant,
                calc_type=label if label in ['percent', 'fixed'] else 'percent',
                default_rate=rate,
                defaults={'name': f"عمولة {rate} ({label})"}
            )
            validated_data['commission_type'] = c_type
            
        return super().update(instance, validated_data)

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
            # We need the most recent exchange rate for the base_equivalent
            from core.models import CurrencyExchangeRate
            rate_obj = CurrencyExchangeRate.objects.filter(tenant=obj.tenant, currency=cur).order_by('-date').first()
            rate = float(rate_obj.rate) if rate_obj else 1.0
            
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
                    'base_equivalent': round(balance * rate, 3)
                })
        return result


# ─── Customer ─────────────────────────────────────────────────────────────────

class CustomerSerializer(serializers.ModelSerializer):
    balances = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone', 'customer_type',
            'credit_balance', 'credit_limit',
            'is_active', 'notes', 'balances',
        ]
        read_only_fields = ['id', 'credit_balance']


    def get_balances(self, obj):
        result = []
        try:
            currencies = Currency.objects.filter(tenant=obj.tenant)
            for cur in currencies:
                from core.models import CurrencyExchangeRate
                rate_obj = CurrencyExchangeRate.objects.filter(tenant=obj.tenant, currency=cur).order_by('-date').first()
                rate = float(rate_obj.rate) if rate_obj else 1.0

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
                        'base_equivalent': round(balance * rate, 3)
                    })
        except:
            pass
        return result
