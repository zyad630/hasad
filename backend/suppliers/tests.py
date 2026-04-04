from django.test import TestCase
from rest_framework.test import APIClient
from core.models import Tenant, CustomUser
from suppliers.models import Supplier, Customer, DealType

class SupplierTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.tenant = Tenant.objects.create(name='Test', subdomain='test')
        self.user = CustomUser.objects.create_user(username='admin', password='123', tenant=self.tenant, role='owner')
        self.client.force_authenticate(user=self.user)

    def test_create_supplier(self):
        url = '/api/suppliers/'
        data = {
            'name': 'Test Supplier',
            'phone': '01000000000',
            'deal_type': DealType.COMMISSION,
            'commission_type': 'percent',
            'commission_rate': 8.5
        }
        res = self.client.post(url, data, format='json', HTTP_HOST='test.localhost:8000')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Supplier.objects.count(), 1)
        self.assertEqual(Supplier.objects.first().name, 'Test Supplier')
