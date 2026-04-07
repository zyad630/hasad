from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from core.models import Tenant, CustomUser
from suppliers.models import Supplier, Customer, DealType, CommissionType
from inventory.models import Item, Shipment, ShipmentItem
from sales.models import Sale, SaleItem


def make_tenant(name='T1', subdomain='t1'):
    return Tenant.objects.create(name=name, subdomain=subdomain)


def make_user(tenant, username='u1', role='cashier'):
    return CustomUser.objects.create_user(
        username=username, password='pass', tenant=tenant, role=role
    )


def make_supplier(tenant, name='Sup'):
    from suppliers.models import CommissionType
    ct, _ = CommissionType.objects.get_or_create(
        tenant=tenant, name='Percent', 
        defaults={'calc_type': 'percent', 'default_rate': Decimal('10.00')}
    )
    return Supplier.objects.create(
        tenant=tenant, name=name,
        deal_type=DealType.COMMISSION,
        commission_type=ct,
    )


def make_sale(tenant, user, customer=None):
    supplier = make_supplier(tenant, name=f'Sup{Sale.objects.count()}')
    item     = Item.objects.create(tenant=tenant, name=f'Item{Sale.objects.count()}')
    shipment = Shipment.objects.create(
        tenant=tenant, supplier=supplier,
        shipment_date=timezone.now().date()
    )
    s_item = ShipmentItem.objects.create(
        shipment=shipment, item=item,
        quantity=Decimal('100'), remaining_qty=Decimal('90')
    )
    sale = Sale.objects.create(
        tenant=tenant, created_by=user,
        customer=customer,
        total_amount=Decimal('500.00'),
    )
    SaleItem.objects.create(
        sale=sale, shipment_item=s_item,
        quantity=Decimal('10'), unit_price=Decimal('50'), subtotal=Decimal('500'),
    )
    return sale


class TestQueryEfficiency(TestCase):
    """M-04: Ensure viewset querysets do not trigger N+1."""

    def setUp(self):
        self.tenant = make_tenant()
        self.user   = make_user(self.tenant, username='owner1', role='owner')

    def _count_queries(self, fn):
        from django.db import reset_queries, connection
        with self.settings(DEBUG=True):
            reset_queries()
            fn()
            return len(connection.queries)

    def test_sale_list_no_n_plus_one(self):
        customer = Customer.objects.create(tenant=self.tenant, name='C')
        for _ in range(10):
            make_sale(self.tenant, self.user, customer=customer)

        def run():
            list(
                Sale.objects.filter(tenant=self.tenant)
                .select_related('customer', 'created_by', 'cancelled_by')
                .prefetch_related('items', 'items__shipment_item', 'items__shipment_item__item')
            )

        n = self._count_queries(run)
        self.assertLessEqual(n, 5, f'N+1 on SaleViewSet: {n} queries for 10 sales')

    def test_shipment_list_no_n_plus_one(self):
        supplier = make_supplier(self.tenant, name='MainSup')
        for _ in range(10):
            Shipment.objects.create(
                tenant=self.tenant, supplier=supplier,
                shipment_date=timezone.now().date()
            )

        def run():
            list(
                Shipment.objects.filter(tenant=self.tenant)
                .select_related('supplier')
                .prefetch_related('items', 'items__item', 'expenses')
            )

        n = self._count_queries(run)
        self.assertLessEqual(n, 4, f'N+1 on ShipmentViewSet: {n} queries for 10 shipments')

    def test_sale_delete_raises(self):
        from django.core.exceptions import PermissionDenied
        sale = make_sale(self.tenant, self.user)
        with self.assertRaises(PermissionDenied):
            sale.delete()

    def test_is_cancelled_defaults_false(self):
        sale = make_sale(self.tenant, self.user)
        self.assertFalse(sale.is_cancelled)
        self.assertEqual(sale.cancel_reason, '')
