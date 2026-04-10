
import os
import django
import uuid

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')
django.setup()

from suppliers.models import Customer, CustomerType
from core.models import Tenant

def test_add_customer():
    tenant = Tenant.objects.first()
    if not tenant:
        print("No tenant found!")
        return
    
    try:
        c = Customer.objects.create(
            tenant=tenant,
            name="Test Customer " + str(uuid.uuid4())[:8],
            customer_type=CustomerType.TRADER
        )
        print("Successfully created customer:", c.name)
        c.delete()
    except Exception as e:
        print("FAILED to create customer!")
        print(e)

if __name__ == "__main__":
    test_add_customer()
