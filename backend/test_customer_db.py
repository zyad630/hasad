import uuid

import pytest

from suppliers.models import Customer, CustomerType
from core.models import Tenant

@pytest.mark.django_db
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
