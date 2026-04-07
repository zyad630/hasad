from rest_framework import serializers
from .models import DailyMovement
from core.serializers import CurrencySerializerMixin

class DailyMovementSerializer(CurrencySerializerMixin, serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    buyer_name = serializers.CharField(source='buyer.name', read_only=True, allow_null=True)

    class Meta:
        model = DailyMovement
        fields = [
            'id', 'daily_seq', 'tx_date', 
            'supplier', 'supplier_name', 'item_name', 'unit', 'count', 
            'gross_weight', 'net_weight', 'purchase_price', 'purchase_total', 
            'commission_rate', 'commission_amount',
            'buyer', 'buyer_name', 'sale_qty', 'sale_price', 'sale_total', 'box_price',
            'currency', 'currency_code', 'currency_symbol', 'currency_name',
            'cash_received', 'check_received', 'expense_amount', 'checks_details'
        ]
        read_only_fields = ['id', 'purchase_total', 'commission_amount', 'sale_total', 'tx_date']
    
    checks_details = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )

    def validate(self, data):
        # Auto calculate totals before saving
        gross = data.get('gross_weight', 0)
        net = data.get('net_weight', 0)
        p_price = data.get('purchase_price', 0)
        c_rate = data.get('commission_rate', 0)
        
        s_qty = data.get('sale_qty', 0)
        s_price = data.get('sale_price', 0)
        b_price = data.get('box_price', 0)
        
        data['purchase_total'] = net * p_price
        data['commission_amount'] = data['purchase_total'] * (c_rate / 100)
        data['sale_total'] = (s_qty * s_price) + (data.get('count', 0) * b_price)
        
        return data
