from rest_framework import serializers
from .models import Supplier, Customer

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'phone', 'deal_type', 'commission_type', 'commission_rate', 'balance', 'whatsapp_number', 'is_active']
        read_only_fields = ['id', 'balance']

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'customer_type', 'credit_balance', 'credit_limit', 'is_active']
        read_only_fields = ['id', 'credit_balance']
