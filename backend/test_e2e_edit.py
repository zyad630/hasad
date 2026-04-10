import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')
django.setup()

from django.test.utils import setup_test_environment
from decimal import Decimal
from django.db import transaction
from django.contrib.auth import get_user_model
User = get_user_model()
from core.models import Tenant, Currency
from suppliers.models import Supplier, CommissionType, Customer, CustomerType
from inventory.models import Item, Shipment, ShipmentItem
from sales.models import Sale, SaleItem
from finance.models import LedgerEntry
from rest_framework.test import APIClient

def run_test():
    client = APIClient()
    
    tenant = Tenant.objects.first()
    if not tenant:
        print("No tenant found. Please load initial data.")
        return False
        
    user = User.objects.filter(tenant=tenant).first()
    if not user:
        user = User.objects.create(username='test_admin', tenant=tenant, role='owner', is_staff=True)
        user.set_password('123')
        user.save()
        
    user.role = 'owner'
    user.save()
        
    client.force_authenticate(user=user)
    
    # 1. Setup Data
    farmer = Supplier.objects.create(tenant=tenant, name="Farmer Test", deal_type="commission")
    customer = Customer.objects.create(tenant=tenant, name="Trader Test", customer_type=CustomerType.TRADER)
    item = Item.objects.create(tenant=tenant, name="Tomato")
    currency = Currency.objects.get(code="ILS", tenant=tenant)
    
    # 2. Receive Shipment
    from datetime import date
    shipment = Shipment.objects.create(tenant=tenant, supplier=farmer, shipment_date=date.today())
    s_item = ShipmentItem.objects.create(shipment=shipment, item=item, quantity=100, remaining_qty=100, unit='kg')
    
    print(f"Initial Inventory: {s_item.remaining_qty}")
    
    # 3. Create a POST Sale (Fake the actual logic)
    sale_data = {
        "customer": customer.id,
        "payment_type": "credit",
        "currency_code": "ILS",
        "exchange_rate": 1.0,
        "items": [
            {
                "shipment_item": s_item.id,
                "quantity": 10,
                "unit_price": 50.0,
                "subtotal": 500.0,
                "commission_rate": 2.0,
                "gross_weight": 0,
                "net_weight": 10
            }
        ]
    }
    
    from sales.services import SaleService
    # Emulate the Sale View POST
    with transaction.atomic():
        sale = Sale.objects.create(
            tenant=tenant, 
            customer=customer, 
            payment_type='credit',
            currency_code='ILS', 
            exchange_rate=Decimal('1.0'),
            foreign_amount=Decimal('510.0'), # 500 + 10 commission
            base_amount=Decimal('510.0'),
            created_by=user
        )
        SaleItem.objects.create(
            sale=sale,
            shipment_item=s_item,
            quantity=Decimal('10'),
            unit_price=Decimal('50.0'),
            subtotal=Decimal('500.0'),
            commission_rate=Decimal('2.0'),
            discount=Decimal('0')
        )
        s_item.remaining_qty -= 10
        s_item.save()
        from finance.services import LedgerService
        LedgerService.record_sale(sale)
        
    print(f"Sale Created ID: {sale.id}, Remaining Inventory: {s_item.remaining_qty}")
    
    initial_ledger_count = LedgerEntry.objects.filter(reference_id=str(sale.id), reference_type='Sale').count()
    print(f"Initial Ledger Entries: {initial_ledger_count}")
    
    # 4. Perform the Edit through the API exactly as the frontend would
    edit_payload = {
        "customer": customer.id,
        "payment_type": "credit",
        "currency_code": "ILS",
        "exchange_rate": 1.0,
        "reason": "Wrong quantity entered",
        "items": [
            {
                "shipment_item": str(s_item.id),
                "quantity": 5, # CHANGING quantity from 10 to 5
                "unit_price": 50.0,
                "commission_rate": 2.0,
                "discount": 0,
                "gross_weight": 0,
                "net_weight": 5
            }
        ]
    }
    
    resp = client.patch(f'/api/sales/{sale.id}/edit/', edit_payload, format='json', HTTP_X_TENANT_ID=str(tenant.id))
    
    if resp.status_code != 200:
        print("API FAILED!")
        print(resp.data)
        return False
        
    print("API SUCCESS: Edit Processed.")
    
    # 5. Verify the aftermath
    s_item.refresh_from_db()
    sale.refresh_from_db()
    
    print(f"After Edit Remaining Inventory (Should be 95): {s_item.remaining_qty}")
    print(f"After Edit Sale Amount (Should be 255.0): {sale.foreign_amount}")
    
    all_ledger = LedgerEntry.objects.filter(reference_id=str(sale.id), reference_type='Sale')
    # Should have original entries, reversal entries, and new entries.
    print(f"Total Ledger Entries mapped to Sale now: {all_ledger.count()}")
    
    return s_item.remaining_qty == 95

if __name__ == '__main__':
    run_test()
