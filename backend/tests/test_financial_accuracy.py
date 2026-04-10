import pytest
from decimal import Decimal, ROUND_HALF_UP
import threading
from django.db import connection
from django.core.exceptions import ValidationError

from core.models import Tenant
from suppliers.models import Supplier, Customer
from inventory.models import Shipment, ShipmentItem, Item, Category
from finance.models import CashTransaction, Settlement, Expense, LedgerEntry, ExpenseCategory
from sales.models import Sale, SaleItem
from sales.services import SaleService
from finance.services import SettlementService

TWO_PLACES = Decimal('0.01')

@pytest.fixture
def tenant(db):
    return Tenant.objects.create(name="Test Tenant", subdomain="test")

@pytest.fixture
def setup_data(db, tenant):
    category = Category.objects.create(tenant=tenant, name="Veggies")
    item = Item.objects.create(tenant=tenant, category=category, name="Tomato", base_unit="kg")
    
    from suppliers.models import CommissionType
    
    ct_percent = CommissionType.objects.create(tenant=tenant, name="Percent", calc_type="percent", default_rate=Decimal("7.5"))
    ct_fixed = CommissionType.objects.create(tenant=tenant, name="Fixed", calc_type="fixed", default_rate=Decimal("50.0"))
    
    supplier_percent = Supplier.objects.create(tenant=tenant, name="Sup1", deal_type="commission", commission_type=ct_percent)
    supplier_fixed = Supplier.objects.create(tenant=tenant, name="Sup2", deal_type="commission", commission_type=ct_fixed)
    
    customer = Customer.objects.create(tenant=tenant, name="Cust1")
    
    ship_percent = Shipment.objects.create(tenant=tenant, supplier=supplier_percent, shipment_date="2025-01-01")
    ship_item_percent = ShipmentItem.objects.create(shipment=ship_percent, item=item, quantity=1000, remaining_qty=1000, unit='kg')

    ship_fixed = Shipment.objects.create(tenant=tenant, supplier=supplier_fixed, shipment_date="2025-01-01")
    ship_item_fixed = ShipmentItem.objects.create(shipment=ship_fixed, item=item, quantity=1000, remaining_qty=1000, unit='kg')

    return {
        'tenant': tenant,
        'supplier_percent': supplier_percent,
        'supplier_fixed': supplier_fixed,
        'ship_percent': ship_percent,
        'ship_fixed': ship_fixed,
        'ship_item_p': ship_item_percent,
        'ship_item_f': ship_item_fixed,
        'customer': customer
    }

@pytest.mark.django_db(transaction=True)
def test_commission_percentage_exactness(setup_data):
    tenant = setup_data['tenant']
    supplier = setup_data['supplier_percent']
    shipment = setup_data['ship_percent']
    ship_item = setup_data['ship_item_p']

    # 1000 EGP sale
    SaleService.create_sale(tenant, None, [{
        'shipment_item_id': ship_item.id,
        'shipment_item': ship_item,
        'quantity': 100,
        'unit_price': 10.00
    }], 'cash', customer_id=setup_data['customer'].id)

    settlement = SettlementService(shipment).confirm(user=None)
    
    assert settlement.total_sales == Decimal("1000.00")
    # 7.5% of 1000 = 75.00 precisely
    assert settlement.commission_amount == Decimal("75.00")

@pytest.mark.django_db(transaction=True)
def test_commission_fixed_amount(setup_data):
    tenant = setup_data['tenant']
    supplier = setup_data['supplier_fixed']
    shipment = setup_data['ship_fixed']
    ship_item = setup_data['ship_item_f']

    # 1000 EGP sale
    SaleService.create_sale(tenant, None, [{
        'shipment_item_id': ship_item.id,
        'shipment_item': ship_item,
        'quantity': 100,
        'unit_price': 10.00
    }], 'cash', customer_id=setup_data['customer'].id)

    settlement = SettlementService(shipment).confirm(user=None)
    
    assert settlement.commission_amount == Decimal("50.00")

@pytest.mark.django_db(transaction=True)
def test_settlement_net_calculation_with_expenses(setup_data):
    tenant = setup_data['tenant']
    shipment = setup_data['ship_percent']
    ship_item = setup_data['ship_item_p']

    # 1000 EGP sale
    SaleService.create_sale(tenant, None, [{
        'shipment_item_id': ship_item.id,
        'shipment_item': ship_item,
        'quantity': 100,
        'unit_price': 10.00
    }], 'cash', customer_id=setup_data['customer'].id)
    
    cat = ExpenseCategory.objects.create(tenant=tenant, name='transport')
    Expense.objects.create(
        tenant=tenant,
        shipment=shipment,
        category=cat,
        currency_code='ILS',
        exchange_rate=Decimal('1'),
        foreign_amount=Decimal('100.00'),
        base_amount=Decimal('100.00'),
        expense_date="2025-01-01"
    )

    settlement = SettlementService(shipment).confirm(user=None)
    
    # Net Supplier: 1000 (sale) - 75 (comm) - 100 (exp) = 825.00
    assert settlement.net_supplier == Decimal("825.00")

@pytest.mark.django_db(transaction=True)
def test_remaining_qty_cannot_be_negative(setup_data):
    tenant = setup_data['tenant']
    ship_item = setup_data['ship_item_p']

    with pytest.raises(ValidationError) as exc:
        SaleService.create_sale(tenant, None, [{
            'shipment_item_id': ship_item.id,
            'shipment_item': ship_item,
            'quantity': 2000, 
            'unit_price': 10.00 
        }], 'cash', customer_id=setup_data['customer'].id)
    # Message might vary by encoding, but it should include remaining quantity.
    assert "1000" in str(exc.value)

@pytest.mark.django_db(transaction=True)
def test_race_condition_concurrent_sales(setup_data):
    tenant = setup_data['tenant']
    ship_item = setup_data['ship_item_p'] 
    
    # We will simulate 2 concurrent requests trying to buy 600 each (Total available 1000)
    # One must fail validation due to lock & decreasing remaining_qty
    def attempt_sale(results, index):
        import django
        import os
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hisba_backend.settings")
        django.setup()
        try:
            SaleService.create_sale(tenant, None, [{
                'shipment_item_id': ship_item.id,
                'shipment_item': ship_item,
                'quantity': 600,
                'unit_price': 10.00
            }], 'cash', customer_id=setup_data['customer'].id)
            results[index] = "Success"
        except ValidationError:
            results[index] = "FailedValidation"
        except Exception as e:
            results[index] = str(e)
        finally:
            connection.close()
            
    results = [None, None]
    t1 = threading.Thread(target=attempt_sale, args=(results, 0))
    t2 = threading.Thread(target=attempt_sale, args=(results, 1))
    
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    
    successes = [r for r in results if r == "Success"]
    # We guarantee absolutely one success and one failure. 1200 > 1000.
    assert len(successes) == 1, f"Expected exactly 1 success, got results: {results}"

@pytest.mark.django_db(transaction=True)
def test_cash_box_integrity(setup_data):
    tenant = setup_data['tenant']
    ship_item = setup_data['ship_item_p']
    customer = setup_data['customer']
    
    SaleService.create_sale(tenant, None, [{
        'shipment_item_id': ship_item.id,
        'shipment_item': ship_item,
        'quantity': 100,
        'unit_price': 10.00
    }], 'cash', customer_id=customer.id) # IN + 1000
    
    CashTransaction.objects.create(
        tenant=tenant, tx_type='in',
        currency_code='ILS', exchange_rate=Decimal('1'),
        foreign_amount=Decimal('200.00'), base_amount=Decimal('200.00'),
        reference_type='other', description='تغذية رصيد'
    )
    CashTransaction.objects.create(
        tenant=tenant, tx_type='out',
        currency_code='ILS', exchange_rate=Decimal('1'),
        foreign_amount=Decimal('50.00'), base_amount=Decimal('50.00'),
        reference_type='other', description='شراء شاي'
    )

    from django.db.models import Sum
    ins = CashTransaction.objects.filter(tenant=tenant, tx_type='in').aggregate(t=Sum('base_amount'))['t'] or Decimal('0')
    outs = CashTransaction.objects.filter(tenant=tenant, tx_type='out').aggregate(t=Sum('base_amount'))['t'] or Decimal('0')

    cash_from_sales = LedgerEntry.get_balance(tenant, 'cash', customer.id, unified_base=True)

    # 1000 (sales ledger) + 200 - 50 = 1150
    assert (cash_from_sales + (ins - outs)).quantize(TWO_PLACES, ROUND_HALF_UP) == Decimal("1150.00")
