from django.test import TestCase
from rest_framework.test import APIClient
from core.models import Tenant, CustomUser
from suppliers.models import Supplier, DealType
from inventory.models import Item, BaseUnit, Shipment, ShipmentItem

class InventoryTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.tenant = Tenant.objects.create(name='Test', subdomain='test')
        self.user = CustomUser.objects.create_user(username='admin', password='123', tenant=self.tenant, role='owner')
        self.supplier = Supplier.objects.create(tenant=self.tenant, name='Sup', deal_type=DealType.COMMISSION)
        self.item = Item.objects.create(tenant=self.tenant, name='Apple', base_unit=BaseUnit.BOX, waste_percentage=2.5)
        self.client.force_authenticate(user=self.user)

    def test_create_shipment(self):
        url = '/api/shipments/'
        data = {
            'supplier': self.supplier.id,
            'shipment_date': '2025-01-01',
            'deal_type': 'commission',
            'notes': 'Test Truck',
            'items': [
                {
                    'item': self.item.id,
                    'quantity': 100,
                    'unit': 'box',
                    'expected_price': 50.0
                }
            ]
        }
        res = self.client.post(url, data, format='json', HTTP_HOST='test.localhost:8000')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Shipment.objects.count(), 1)
        
        # Verify ShipmentItem is created and remaining_qty equals quantity
        s_item = ShipmentItem.objects.first()
        self.assertEqual(s_item.shipment.notes, 'Test Truck')
        self.assertEqual(float(s_item.quantity), 100.0)
        self.assertEqual(float(s_item.remaining_qty), 100.0)
