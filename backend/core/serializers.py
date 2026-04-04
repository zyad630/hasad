from rest_framework import serializers
from .models import Tenant, CustomUser


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
        fields = ['id', 'username', 'role', 'permissions_list', 'is_active', 'tenant_name']
        read_only_fields = ['id']

    def get_tenant_name(self, obj):
        return obj.tenant.name if obj.tenant else None

    def get_permissions_list(self, obj):
        # Return role-based permissions
        role_permissions = {
            'super_admin': ['all'],
            'owner': ['can_sell', 'can_settle', 'can_manage_suppliers', 'can_view_reports'],
            'cashier': ['can_sell'],
            'admin': ['can_sell', 'can_settle', 'can_manage_suppliers', 'can_view_reports'],
        }
        return role_permissions.get(obj.role, [])


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
