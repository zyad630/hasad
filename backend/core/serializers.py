from rest_framework import serializers
from .models import Tenant, CustomUser, Currency

class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = ['id', 'code', 'name', 'symbol', 'is_base']

from .models import CurrencyExchangeRate

class CurrencyExchangeRateSerializer(serializers.ModelSerializer):
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    currency_name = serializers.CharField(source='currency.name', read_only=True)
    
    class Meta:
        model = CurrencyExchangeRate
        fields = ['id', 'currency', 'currency_code', 'currency_name', 'rate', 'date', 'created_at']

class CurrencySerializerMixin(serializers.Serializer):
    currency_symbol = serializers.SerializerMethodField()
    currency_name = serializers.SerializerMethodField()

    def get_currency_symbol(self, obj):
        try:
            # Assumes obj has tenant and currency_code
            cur = Currency.objects.filter(tenant=obj.tenant, code=obj.currency_code).first()
            return cur.symbol if cur else obj.currency_code
        except:
            return getattr(obj, 'currency_code', 'ILS')

    def get_currency_name(self, obj):
        try:
            cur = Currency.objects.filter(tenant=obj.tenant, code=obj.currency_code).first()
            return cur.name if cur else obj.currency_code
        except:
            return getattr(obj, 'currency_code', 'ILS')


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'subdomain', 'status', 'trial_ends_at', 'created_at']
        read_only_fields = ['id', 'created_at']


class CustomUserSerializer(serializers.ModelSerializer):
    tenant_name = serializers.SerializerMethodField()
    permissions_list = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'first_name', 'role', 'permissions', 'permissions_list', 'is_active', 'is_staff', 'tenant_name']
        read_only_fields = ['id', 'permissions_list']

    def get_tenant_name(self, obj):
        return obj.tenant.name if obj.tenant else None

    def get_permissions_list(self, obj):
        if obj.role == 'super_admin':
            return ['all']
            
        role_base = {
            'owner': ['pos', 'shipments', 'suppliers', 'customers', 'finance', 'reports', 'hr', 'settings'],
            'cashier': ['pos'],
        }.get(obj.role, [])
        
        # Merge with granular JSON permissions
        granular = obj.permissions if isinstance(obj.permissions, list) else []
        return list(set(role_base + granular))


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)


class RegisterTenantSerializer(serializers.Serializer):
    tenant_name = serializers.CharField(max_length=200)
    subdomain = serializers.CharField(max_length=100)
    owner_username = serializers.CharField(max_length=150)
    owner_password = serializers.CharField(write_only=True)

from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = AuditLog
        fields = ['id', 'username', 'action', 'entity_type', 'entity_id', 'delta', 'created_at']
        read_only_fields = ['id', 'created_at']
