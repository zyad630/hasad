import os
import sys
import django

sys.path.append('c:/Users/zyad/Desktop/soqe vegtable/hisba-saas/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')
django.setup()

from sales.models import Sale
from core.models import Tenant, CustomUser
from suppliers.models import Customer
from django.db import connection

tenant = Tenant.objects.first()
user = CustomUser.objects.first()
customer = Customer.objects.create(tenant=tenant, name='Cust1')

Sale.objects.filter(tenant=tenant).delete()

for i in range(10):
    Sale.objects.create(tenant=tenant, customer=customer, created_by=user, total_amount=10)

sales = Sale.objects.filter(tenant=tenant)[:10]

import time
start_queries = len(connection.queries)
for sale in sales:
    x = sale.customer.name if sale.customer else None
    y = sale.created_by.username if sale.created_by else None

end_queries = len(connection.queries)
print(f"Num Queries DB hit: {end_queries - start_queries}")
