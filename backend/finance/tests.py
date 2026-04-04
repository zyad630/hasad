from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from core.models import Tenant, CustomUser
from suppliers.models import Supplier, DealType, CommissionType
from inventory.models import Item, Shipment, ShipmentItem
from sales.models import Sale, SaleItem, PaymentType
from finance.models import Settlement
from rest_framework.test import APIClient


class SettlementTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.tenant = Tenant.objects.create(name='Test', subdomain='test')
        self.user = CustomUser.objects.create_user(
            username='admin', password='123', tenant=self.tenant, role='owner'
        )
        self.supplier = Supplier.objects.create(
            tenant=self.tenant, name='Sub', deal_type=DealType.COMMISSION,
            commission_type=CommissionType.PERCENT, commission_rate=Decimal('10.00')
        )
        self.item = Item.objects.create(tenant=self.tenant, name='Potato')
        self.shipment = Shipment.objects.create(
            tenant=self.tenant, supplier=self.supplier,
            shipment_date=timezone.now().date()
        )
        self.s_item = ShipmentItem.objects.create(
            shipment=self.shipment, item=self.item,
            quantity=Decimal('100.000'), remaining_qty=Decimal('50.000')
        )

        # Create Sales to generate value
        self.sale = Sale.objects.create(
            tenant=self.tenant, total_amount=Decimal('1000.00')
        )
        SaleItem.objects.create(
            sale=self.sale, shipment_item=self.s_item,
            quantity=Decimal('50.000'), unit_price=Decimal('20.00'),
            subtotal=Decimal('1000.00')
        )

        self.client.force_authenticate(user=self.user)

    def test_settlement_engine(self):
        url = '/api/settlements/confirm/'
        data = {'shipment_id': self.shipment.id}
        response = self.client.post(url, data, format='json', HTTP_HOST='test.localhost:8000')
        self.assertEqual(response.status_code, 201)

        # Sales = 1000, Commission (10%) = 100, Expenses = 0, Net = 900
        settlement = Settlement.objects.get(shipment=self.shipment)
        self.assertEqual(settlement.total_sales,       Decimal('1000.00'))
        self.assertEqual(settlement.commission_amount, Decimal('100.00'))
        self.assertEqual(settlement.net_supplier,      Decimal('900.00'))

        # Shipment must be marked settled
        self.shipment.refresh_from_db()
        self.assertEqual(self.shipment.status, 'settled')

    def test_cashier_cannot_confirm_settlement(self):
        cashier = CustomUser.objects.create_user(
            username='cashier1', password='123', tenant=self.tenant, role='cashier'
        )
        self.client.force_authenticate(user=cashier)
        response = self.client.post(
            '/api/settlements/confirm/',
            {'shipment_id': str(self.shipment.id)},
            format='json', HTTP_HOST='test.localhost:8000'
        )
        self.assertEqual(response.status_code, 403)

    def test_sale_delete_is_blocked(self):
        from django.core.exceptions import PermissionDenied
        with self.assertRaises(PermissionDenied):
            self.sale.delete()
