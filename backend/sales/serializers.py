from rest_framework import serializers
from django.db import transaction
from .models import Sale, SaleItem, ContainerTransaction
from inventory.models import ShipmentItem

from core.serializers import CurrencySerializerMixin

class SaleItemSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='shipment_item.item.name', read_only=True)
    class Meta:
        model = SaleItem
        fields = [
            'id', 'shipment_item', 'item_name', 'quantity', 'unit_price', 'subtotal', 
            'containers_out', 'commission_rate', 'discount', 'gross_weight', 'net_weight'
        ]
        read_only_fields = ['id', 'subtotal']

class SaleSerializer(CurrencySerializerMixin, serializers.ModelSerializer):
    items = SaleItemSerializer(many=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = Sale
        fields = [
            'id', 'customer', 'customer_name', 'sale_date', 'payment_type', 
            'currency_code', 'exchange_rate', 'currency_symbol', 'currency_name',
            'foreign_amount', 'base_amount', 'items'
        ]
        read_only_fields = ['id', 'sale_date', 'foreign_amount', 'base_amount']

    def validate(self, data):
        for item_data in data.get('items', []):
            shipment_item = item_data['shipment_item']
            if item_data['quantity'] > shipment_item.remaining_qty:
                raise serializers.ValidationError(
                    f"الكمية المطلوبة ({item_data['quantity']}) أكبر من الكمية المتبقية ({shipment_item.remaining_qty}) للصنف {shipment_item.item.name}"
                )
        return data

    def create(self, validated_data):
        from .services import SaleService
        items_data = validated_data.pop('items')
        request = self.context.get('request')
        tenant = request.tenant if request else None
        user = request.user if request else None
        
        return SaleService.create_sale(
            tenant=tenant,
            user=user,
            customer=validated_data.get('customer'),
            payment_type=validated_data.get('payment_type', 'cash'),
            currency_code=validated_data.get('currency_code', 'ILS'),
            exchange_rate=validated_data.get('exchange_rate', 1),
            items_data=items_data,
            discount=validated_data.get('discount', 0)
        )

class ContainerTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContainerTransaction
        fields = ['id', 'customer', 'sale', 'container_type', 'direction', 'quantity', 'tx_date']
        read_only_fields = ['id', 'tx_date']
