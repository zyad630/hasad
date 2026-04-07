"""
Serializers for Modules 3-7:
  Module 3 — ItemUnit
  Module 4 — SalesOrder, PurchaseOrder
  Module 5 — SaleReturn, PurchaseReturn
  Module 7 — AdvancedCheck
"""
from rest_framework import serializers
from inventory.models import ItemUnit
from sales.models import (
    SalesOrder, SalesOrderItem, PurchaseOrder, PurchaseOrderItem,
    SaleReturn, SaleReturnItem, PurchaseReturn, PurchaseReturnItem,
)
from finance.models import AdvancedCheck


# ── Module 3: ItemUnit ─────────────────────────────────────────────────────────

class ItemUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemUnit
        fields = ['id', 'item', 'unit_name', 'conversion_factor', 'buy_price', 'sell_price', 'is_default']
        read_only_fields = ['id']


# ── Module 4: SalesOrder ───────────────────────────────────────────────────────

class SalesOrderItemSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = SalesOrderItem
        fields = ['id', 'item', 'item_name', 'unit_name', 'quantity', 'unit_price', 'subtotal']
        read_only_fields = ['id', 'subtotal']

    def validate(self, data):
        data['subtotal'] = data['quantity'] * data['unit_price']
        return data


class SalesOrderSerializer(serializers.ModelSerializer):
    items        = SalesOrderItemSerializer(many=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    total        = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrder
        fields = ['id', 'customer', 'customer_name', 'order_date', 'status', 'notes',
                  'converted_sale', 'items', 'total', 'created_at']
        read_only_fields = ['id', 'order_date', 'converted_sale', 'created_at']

    def get_total(self, obj):
        return sum(i.subtotal for i in obj.items.all())

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        order = SalesOrder.objects.create(**validated_data)
        for item_data in items_data:
            SalesOrderItem.objects.create(order=order, **item_data)
        return order

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                SalesOrderItem.objects.create(order=instance, **item_data)
        return instance


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = ['id', 'item', 'item_name', 'unit_name', 'quantity', 'unit_price', 'subtotal']
        read_only_fields = ['id', 'subtotal']

    def validate(self, data):
        data['subtotal'] = data['quantity'] * data['unit_price']
        return data


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items         = PurchaseOrderItemSerializer(many=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    total         = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = ['id', 'supplier', 'supplier_name', 'order_date', 'status', 'notes',
                  'converted_shipment', 'items', 'total', 'created_at']
        read_only_fields = ['id', 'order_date', 'converted_shipment', 'created_at']

    def get_total(self, obj):
        return sum(i.subtotal for i in obj.items.all())

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        order = PurchaseOrder.objects.create(**validated_data)
        for item_data in items_data:
            PurchaseOrderItem.objects.create(order=order, **item_data)
        return order


# ── Module 5: Returns ──────────────────────────────────────────────────────────

class SaleReturnItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleReturnItem
        fields = ['id', 'shipment_item', 'quantity', 'unit_price', 'subtotal']
        read_only_fields = ['id', 'subtotal']

    def validate(self, data):
        data['subtotal'] = data['quantity'] * data['unit_price']
        return data


class SaleReturnSerializer(serializers.ModelSerializer):
    items             = SaleReturnItemSerializer(many=True)
    original_sale_ref = serializers.CharField(source='original_sale_id', read_only=True)

    class Meta:
        model = SaleReturn
        fields = ['id', 'original_sale', 'original_sale_ref', 'return_date',
                  'reason', 'notes', 'return_amount', 'items']
        read_only_fields = ['id', 'return_date', 'return_amount']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        from decimal import Decimal
        total = sum(Decimal(str(i['quantity'])) * Decimal(str(i['unit_price'])) for i in items_data)
        validated_data['return_amount'] = total
        ret = SaleReturn.objects.create(**validated_data)
        for item_data in items_data:
            item_data['subtotal'] = item_data['quantity'] * item_data['unit_price']
            SaleReturnItem.objects.create(sale_return=ret, **item_data)
        return ret


class PurchaseReturnItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseReturnItem
        fields = ['id', 'shipment_item', 'quantity', 'unit_price', 'subtotal']
        read_only_fields = ['id', 'subtotal']

    def validate(self, data):
        data['subtotal'] = data['quantity'] * data['unit_price']
        return data


class PurchaseReturnSerializer(serializers.ModelSerializer):
    items = PurchaseReturnItemSerializer(many=True)

    class Meta:
        model = PurchaseReturn
        fields = ['id', 'original_shipment', 'return_date', 'reason', 'notes', 'return_amount', 'items']
        read_only_fields = ['id', 'return_date', 'return_amount']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        from decimal import Decimal
        total = sum(Decimal(str(i['quantity'])) * Decimal(str(i['unit_price'])) for i in items_data)
        validated_data['return_amount'] = total
        ret = PurchaseReturn.objects.create(**validated_data)
        for item_data in items_data:
            item_data['subtotal'] = item_data['quantity'] * item_data['unit_price']
            PurchaseReturnItem.objects.create(purchase_return=ret, **item_data)
        return ret


# ── Module 7: AdvancedCheck ────────────────────────────────────────────────────

class AdvancedCheckSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    can_deposit   = serializers.SerializerMethodField()
    can_clear     = serializers.SerializerMethodField()
    can_bounce    = serializers.SerializerMethodField()

    class Meta:
        model = AdvancedCheck
        fields = [
            'id', 'check_number', 'bank_name', 'branch', 'due_date',
            'amount', 'currency_code', 'direction', 'lifecycle',
            'customer', 'customer_name', 'supplier', 'supplier_name', 'drawer_name',
            'deposited_at', 'cleared_at', 'bounced_at', 'bounce_reason',
            'created_at', 'can_deposit', 'can_clear', 'can_bounce',
        ]
        read_only_fields = ['id', 'deposited_at', 'cleared_at', 'bounced_at', 'created_at']

    def get_can_deposit(self, obj):
        return obj.can_transition_to('deposited')

    def get_can_clear(self, obj):
        return obj.can_transition_to('cleared')

    def get_can_bounce(self, obj):
        return obj.can_transition_to('bounced')
