from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from core.models import Tenant, CustomUser
from suppliers.models import Supplier, Customer, DealType
from inventory.models import Category, Item, Shipment, ShipmentItem, BaseUnit
from sales.models import Sale, SaleItem, PaymentType

class SaleLogicTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.tenant = Tenant.objects.create(name='Test Tenant', subdomain='test')
        self.user = CustomUser.objects.create_user(username='test_user', password='password', tenant=self.tenant, role='cashier')
        self.supplier = Supplier.objects.create(tenant=self.tenant, name='Test Supplier', deal_type=DealType.COMMISSION)
        self.customer = Customer.objects.create(tenant=self.tenant, name='Test Customer')
        self.item = Item.objects.create(tenant=self.tenant, name='Tomato', base_unit=BaseUnit.KG)
        self.shipment = Shipment.objects.create(tenant=self.tenant, supplier=self.supplier, shipment_date=timezone.now().date())
        self.shipment_item = ShipmentItem.objects.create(
            shipment=self.shipment, item=self.item, quantity=100.0, unit='kg', remaining_qty=100.0, expected_price=10.0
        )
        self.client.force_authenticate(user=self.user)

    def test_create_sale_deducts_inventory_and_updates_credit(self):
        url = '/api/sales/'
        data = {
            'customer': self.customer.id,
            'payment_type': 'credit',
            'items': [
                {
                    'shipment_item': self.shipment_item.id,
                    'quantity': 20.0,
                    'unit_price': 15.0,
                    'containers_out': 2
                }
            ]
        }
        # Simulate request subdomain matching for tenant middleware logic
        response = self.client.post(url, data, format='json', HTTP_HOST='test.localhost:8000')
        self.assertEqual(response.status_code, 201)
        
        # Check inventory is deducted
        self.shipment_item.refresh_from_db()
        self.assertEqual(float(self.shipment_item.remaining_qty), 80.0)
        
        # Check credit balance is updated
        self.customer.refresh_from_db()
        self.assertEqual(float(self.customer.credit_balance), 300.0) # 20 * 15

    def test_over_quantity_sale_fails(self):
        url = '/api/sales/'
        data = {
            'customer': self.customer.id,
            'payment_type': 'cash',
            'items': [
                {
                    'shipment_item': self.shipment_item.id,
                    'quantity': 150.0, # more than remaining 100
                    'unit_price': 15.0
                }
            ]
        }
        response = self.client.post(url, data, format='json', HTTP_HOST='test.localhost:8000')
        self.assertEqual(response.status_code, 400)
        
        # Ensure quantity did NOT change (atomic rollback triggered by validation)
        self.shipment_item.refresh_from_db()
        self.assertEqual(float(self.shipment_item.remaining_qty), 100.0)
