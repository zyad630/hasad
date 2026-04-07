from django.test import TestCase
from rest_framework.test import APIClient
from core.models import Tenant, CustomUser
from suppliers.models import CommissionType, Supplier, Customer, DealType


class SupplierTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.tenant = Tenant.objects.create(name='Test', subdomain='test')
        self.user = CustomUser.objects.create_user(
            username='admin', password='123', tenant=self.tenant, role='owner'
        )
        self.client.force_authenticate(user=self.user)
        # Create a CommissionType for the tenant (Module 1 requirement)
        self.commission_type = CommissionType.objects.create(
            tenant=self.tenant,
            name='نسبة مئوية',
            calc_type='percent',
            default_rate=7.00,
        )

    def test_create_supplier(self):
        url = '/api/suppliers/'
        data = {
            'name': 'Test Supplier',
            'phone': '01000000000',
            'deal_type': DealType.COMMISSION,
            'commission_type': str(self.commission_type.id),
        }
        res = self.client.post(url, data, format='json', HTTP_HOST='test.localhost:8000')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Supplier.objects.count(), 1)
        self.assertEqual(Supplier.objects.first().name, 'Test Supplier')

    def test_commission_rate_auto_pulled(self):
        """Verify commission_rate is auto-returned from linked CommissionType."""
        url = '/api/suppliers/'
        data = {
            'name': 'Farmer Ali',
            'deal_type': DealType.COMMISSION,
            'commission_type': str(self.commission_type.id),
        }
        res = self.client.post(url, data, format='json', HTTP_HOST='test.localhost:8000')
        self.assertEqual(res.status_code, 201)
        detail = self.client.get(
            f"/api/suppliers/{res.data['id']}/",
            HTTP_HOST='test.localhost:8000'
        )
        self.assertIn('commission_rate', detail.data)
        self.assertEqual(detail.data['commission_rate']['calc_type'], 'percent')
        self.assertEqual(float(detail.data['commission_rate']['rate']), 7.0)
