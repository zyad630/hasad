import os
import sys
import django
import threading

sys.path.append('c:/Users/zyad/Desktop/soqe vegtable/hisba-saas/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')
django.setup()

from decimal import Decimal
from sales.services import SaleService
from core.models import Tenant, CustomUser
from suppliers.models import Supplier
from inventory.models import Shipment, ShipmentItem

# Create test data
import uuid
random_sub = str(uuid.uuid4())[:8]
tenant, _ = Tenant.objects.get_or_create(subdomain=random_sub, defaults={'name': 'Tenant Race'})
user, _ = CustomUser.objects.get_or_create(username=random_sub, tenant=tenant)
supplier, _ = Supplier.objects.get_or_create(tenant=tenant, name='Supplier Race')
shipment, _ = Shipment.objects.get_or_create(tenant=tenant, supplier=supplier)

# Make sure we start with 10 qty
shipment_item = ShipmentItem.objects.create(
    shipment=shipment, product_name='Tomato',
    received_qty=10, remaining_qty=10, cost_price=Decimal('5.00')
)

results = []
def sell():
    try:
        # Buy 8 items
        SaleService.create_sale(
            tenant=tenant,
            user=user,
            items_data=[{'shipment_item_id': shipment_item.id, 'quantity': 8, 'unit_price': 10}],
            payment_type='cash',
            customer_id=None
        )
        results.append('success')
    except Exception as e:
        results.append('fail')

threads = [threading.Thread(target=sell) for _ in range(10)]
[t.start() for t in threads]
[t.join() for t in threads]

print("Expected: exactly 1 success, 9 fails, remaining_qty = 2")
actual_qty = ShipmentItem.objects.get(id=shipment_item.id).remaining_qty
print(f"Results: {results.count('success')} success, {results.count('fail')} fails")
print(f"Actual remaining_qty: {actual_qty}")
