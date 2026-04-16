from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import DailyMovement
from .serializers import DailyMovementSerializer
from .services import DailyMovementService

class DailyMovementViewSet(viewsets.ModelViewSet):
    serializer_class = DailyMovementSerializer

    def get_queryset(self):
        qs = DailyMovement.objects.filter(tenant=self.request.tenant)
        date = self.request.query_params.get('date')
        date_from = self.request.query_params.get('from')
        date_to = self.request.query_params.get('to')
        
        if date:
            qs = qs.filter(tx_date=date)
        if date_from:
            qs = qs.filter(tx_date__gte=date_from)
        if date_to:
            qs = qs.filter(tx_date__lte=date_to)
            
        return qs.order_by('-tx_date', 'daily_seq')

    def perform_create(self, serializer):
        checks_details = serializer.validated_data.pop('checks_details', [])
        movement = serializer.save(tenant=self.request.tenant)
        # Handle financial automation
        DailyMovementService.process_movement(movement, checks_details=checks_details)

from rest_framework.views import APIView
from django.db import transaction
from django.utils import timezone
from inventory.models import Shipment, ShipmentItem, Item
from sales.services import SaleService
from suppliers.models import Supplier, Customer
from decimal import Decimal

class FastTranscriptionView(APIView):
    @transaction.atomic
    def post(self, request):
        data = request.data
        tenant = request.tenant
        user = request.user
        
        try:
            supplier_id = data.get('supplier')
            buyer_id = data.get('buyer')
            item_name = data.get('item_name')
            count = int(data.get('count') or 0)
            net_weight = Decimal(str(data.get('net_weight') or 0))
            price = Decimal(str(data.get('price') or 0))
            supp_comm = Decimal(str(data.get('supplier_commission') or 0))
            buy_comm = Decimal(str(data.get('buyer_commission') or 0))

            if not supplier_id:
                raise ValueError('supplier is required')
            if not buyer_id:
                raise ValueError('buyer is required')
            if not item_name:
                raise ValueError('item_name is required')
            if net_weight <= 0:
                raise ValueError('net_weight must be greater than 0')
            if price <= 0:
                raise ValueError('price must be greater than 0')
            
            # Get Item
            item_obj, _ = Item.objects.get_or_create(tenant=tenant, name=str(item_name)[:50])
            
            # 1. Create Purchase Shipment (Farmer side)
            supplier = Supplier.objects.get(id=supplier_id, tenant=tenant)
            shipment = Shipment.objects.create(
                tenant=tenant,
                supplier=supplier,
                shipment_date=timezone.now().date(),
                status='open'
            )
            
            shipment_item = ShipmentItem.objects.create(
                shipment=shipment,
                item=item_obj,
                quantity=net_weight, 
                remaining_qty=net_weight, 
                unit='kg', # Defaulting to kg as expected by transcription
                expected_price=price,
                boxes_count=count
            )
            
            # 2. Create Sale (Buyer side)
            buyer = Customer.objects.get(id=buyer_id, tenant=tenant)
            
            items_data = [{
                'shipment_item': shipment_item, 
                'quantity': net_weight,
                'unit_price': price,
                'commission_rate': supp_comm, # Farmer
                'buyer_commission_rate': buy_comm, # Buyer
                'gross_weight': net_weight,
                'net_weight': net_weight,
                'containers_out': count,
                'loading_fee': 0, 'unloading_fee': 0, 'floor_fee': 0, 'delivery_fee': 0,
                'discount': 0
            }]
            
            # Create Sale -> triggers LedgerService for buyer automatically via SaleService
            sale = SaleService.create_sale(
                tenant=tenant,
                user=user,
                items_data=items_data,
                payment_type='credit',
                customer_id=buyer_id,
                sale_date=timezone.now()
            )
            
            # We must process the Shipment strictly to generate ledger entries for the SUPPLIER!
            # These ledger entries record the purchase from the farmer.
            from finance.services import SettlementService
            
            # Since we just created the Sale and it's linked to the shipment_item, 
            # SettlementService.calculate() will pick it up.
            settlement_service = SettlementService(shipment)
            settlement_service.confirm(user=user)

            return Response({'status': 'success', 'sale_id': sale.id})
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
