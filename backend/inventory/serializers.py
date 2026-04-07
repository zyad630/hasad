from rest_framework import serializers
from .models import Category, Item, UnitConversion, Shipment, ShipmentItem

class UnitConversionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitConversion
        fields = ['id', 'from_unit', 'to_unit', 'factor']

class ItemSerializer(serializers.ModelSerializer):
    conversions = UnitConversionSerializer(many=True, read_only=True)
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), required=False, allow_null=True)

    def create(self, validated_data):
        request = self.context.get('request')
        tenant = request.tenant if request else None
        
        if not validated_data.get('category') and tenant:
            cat, _ = Category.objects.get_or_create(
                tenant=tenant,
                name="عام",
                defaults={'name': 'عام'}
            )
            validated_data['category'] = cat
            
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Allow partial update without breaking the category
        return super().update(instance, validated_data)

    class Meta:
        model = Item
        fields = ['id', 'category', 'name', 'base_unit', 'waste_percentage', 'is_active', 'conversions']
        read_only_fields = ['id']

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']
        read_only_fields = ['id']

class ShipmentItemSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    class Meta:
        model = ShipmentItem
        fields = ['id', 'item', 'item_name', 'quantity', 'unit', 'boxes_count', 'remaining_qty', 'expected_price']
        read_only_fields = ['id', 'remaining_qty']

class ShipmentSerializer(serializers.ModelSerializer):
    items = ShipmentItemSerializer(many=True, required=False)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = Shipment
        fields = ['id', 'supplier', 'supplier_name', 'shipment_date', 'deal_type', 'status', 'notes', 'created_at', 'items']
        read_only_fields = ['id', 'created_at', 'status']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        shipment = Shipment.objects.create(**validated_data)
        for item_data in items_data:
            item_data['remaining_qty'] = item_data['quantity']
            ShipmentItem.objects.create(shipment=shipment, **item_data)
        return shipment
