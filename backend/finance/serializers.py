from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from .models import Settlement, Expense, CashTransaction
from inventory.models import Shipment
from suppliers.models import Supplier

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = ['id', 'shipment', 'expense_type', 'amount', 'description', 'expense_date']
        read_only_fields = ['id']

class CashTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashTransaction
        fields = ['id', 'tx_type', 'amount', 'reference_type', 'reference_id', 'description', 'tx_date']
        read_only_fields = ['id', 'tx_date']

class SettlementSerializer(serializers.ModelSerializer):
    shipment_date = serializers.DateField(source='shipment.shipment_date', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = Settlement
        fields = ['id', 'shipment', 'shipment_date', 'supplier', 'supplier_name',
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
