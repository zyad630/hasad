from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from core.models import Tenant, CustomUser
from suppliers.models import CommissionType, Supplier, DealType
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
        # Module 1: CommissionType as proper model
        self.commission_type = CommissionType.objects.create(
            tenant=self.tenant,
            name='نسبة مئوية',
            calc_type='percent',
            default_rate=Decimal('10.00'),
        )
        self.supplier = Supplier.objects.create(
            tenant=self.tenant, name='Sub', deal_type=DealType.COMMISSION,
            commission_type=self.commission_type,
        )
        self.item = Item.objects.create(tenant=self.tenant, name='Potato')
        self.shipment = Shipment.objects.create(
            tenant=self.tenant, supplier=self.supplier,
            shipment_date=timezone.now().date()
        )
        self.s_item = ShipmentItem.objects.create(
            shipment=self.shipment, item=self.item,
            quantity=Decimal('100.000'), remaining_qty=Decimal('50.000'),
            unit='kg',
        )

        # Create Sales to generate value
        self.sale = Sale.objects.create(
            tenant=self.tenant, foreign_amount=Decimal('1000.00'), base_amount=Decimal('1000.00')
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

    def test_settlement_entries_are_balanced_and_include_generic_expenses(self):
        from finance.models import Expense, ExpenseCategory, LedgerEntry

        category = ExpenseCategory.objects.create(tenant=self.tenant, name='General')
        Expense.objects.create(
            tenant=self.tenant,
            shipment=self.shipment,
            category=category,
            currency_code='ILS',
            exchange_rate=Decimal('1'),
            foreign_amount=Decimal('50.00'),
            base_amount=Decimal('50.00'),
            description='Packing',
            expense_date=timezone.now().date(),
        )

        response = self.client.post(
            '/api/settlements/confirm/',
            {'shipment_id': self.shipment.id},
            format='json',
            HTTP_HOST='test.localhost:8000',
        )
        self.assertEqual(response.status_code, 201)

        settlement = Settlement.objects.get(shipment=self.shipment)
        entries = LedgerEntry.objects.filter(
            tenant=self.tenant,
            reference_type='settlement',
            reference_id=settlement.id,
        )
        total_dr = sum((entry.base_amount for entry in entries if entry.entry_type == LedgerEntry.DEBIT), Decimal('0.000'))
        total_cr = sum((entry.base_amount for entry in entries if entry.entry_type == LedgerEntry.CREDIT), Decimal('0.000'))

        self.assertEqual(total_dr, total_cr)
        self.assertTrue(
            entries.filter(account_type='general_expense', entry_type='CR').exists()
        )
        self.assertEqual(
            LedgerEntry.get_balance(self.tenant, 'supplier', self.supplier.id),
            Decimal('-850.000')
        )

class VegetableTradingDayTestCase(TestCase):
    """
    Validates Requirement 4: Comprehensive 'Vegetable Trading Day' scenario.
    Ensures no disconnected modules exist and that all financial movements correctly update the ledger.
    Flow: Purchase -> Sale -> Expense -> Settlement -> Payment
    """
    def setUp(self):
        self.client = APIClient()
        self.tenant = Tenant.objects.create(name='Test Tenant')
        self.user = CustomUser.objects.create_user(
            username='admin', password='123', tenant=self.tenant, role='owner'
        )
        self.client.force_authenticate(user=self.user)
        self.commission_type = CommissionType.objects.create(
            tenant=self.tenant, name='نسبة مئوية', calc_type='percent', default_rate=Decimal('10.00'),
        )
        
    def test_full_trading_day_cycle(self):
        from suppliers.models import Customer
        from finance.models import LedgerEntry, CashTransaction
        
        # 1. Create Supplier (Farmer) and Customer (Trader)
        supplier = Supplier.objects.create(tenant=self.tenant, name='Farmer Ziad', deal_type=DealType.COMMISSION, commission_type=self.commission_type)
        customer = Customer.objects.create(tenant=self.tenant, name='Trader Ali')
        
        # 2. Purchase (Shipment) Setup
        item = Item.objects.create(tenant=self.tenant, name='Tomato Box')
        shipment = Shipment.objects.create(tenant=self.tenant, supplier=supplier, shipment_date=timezone.now().date())
        s_item = ShipmentItem.objects.create(shipment=shipment, item=item, quantity=Decimal('100.000'), remaining_qty=Decimal('100.000'), unit='box')

        # 3. Create Sale (Sale to Customer on Credit)
        sale = Sale.objects.create(tenant=self.tenant, customer=customer, foreign_amount=Decimal('500.00'), base_amount=Decimal('500.00'), payment_type=PaymentType.CREDIT)
        SaleItem.objects.create(sale=sale, shipment_item=s_item, quantity=Decimal('20.000'), unit_price=Decimal('25.00'), subtotal=Decimal('500.00'))
        
        from finance.services import LedgerService
        LedgerService.record_sale(sale)
        
        # Ledger Check 1: Customer should owe 500
        cust_bal = LedgerEntry.get_balance(self.tenant, 'customer', customer.id)
        self.assertEqual(cust_bal, Decimal('500.000'), "Customer should owe 500 after credit sale")
        
        # 4. Add Shipment Expense (Transportation) paid in cash
        from finance.models import Expense, ExpenseCategory
        from finance.services import LedgerService
        expense_cat = ExpenseCategory.objects.create(tenant=self.tenant, name='نقل')
        expense = Expense.objects.create(tenant=self.tenant, shipment=shipment, category=expense_cat, foreign_amount=Decimal('50.00'), base_amount=Decimal('50.00'), description='نقل', expense_date=timezone.now().date())
        LedgerService.record_general_expense(expense, user=self.user)
        
        # Ledger Check 2: Cash should be -50 (we paid out)
        cash_bal = LedgerEntry.get_balance(self.tenant, 'cash', self.tenant.id)
        self.assertEqual(cash_bal, Decimal('-50.000'), "Cash should be -50 after expense")
        
        # 5. Settlement Confirmed (Commission: 50, Expense: 50, Net: 400)
        from finance.services import SettlementService
        service = SettlementService(shipment)
        settlement = service.confirm(user=self.user)
        
        # Ledger Check 3: Supplier owes us nothing, we owe them 400 (CR balance is negative in our view, but let's check exact get_balance which is dr - cr)
        # get_balance returns DR - CR. Credit means we owe them. So we owe 400 -> -400.
        sup_bal = LedgerEntry.get_balance(self.tenant, 'supplier', supplier.id)
        self.assertEqual(sup_bal, Decimal('-400.000'), "Supplier balance should be 400 Credit")

        # 6. Payment (Receive Cash from Customer)
        # This mirrors CashTransactionViewSet
        # Dr Cash 500, Cr Customer 500
        LedgerService._double_entry(
            tenant=self.tenant,
            dr_type='cash', dr_id=self.tenant.id,
            cr_type='customer', cr_id=customer.id,
            amount=Decimal('500.00'), currency_code='ILS', exchange_rate=1,
            ref_type='receipt', ref_id=self.tenant.id, description='Payment from customer', user=self.user
        )

        cust_bal_after = LedgerEntry.get_balance(self.tenant, 'customer', customer.id)
        self.assertEqual(cust_bal_after, Decimal('0.000'), "Customer balance should be 0 after payment")
        
        cash_bal_after = LedgerEntry.get_balance(self.tenant, 'cash', self.tenant.id)
        self.assertEqual(cash_bal_after, Decimal('450.000'), "Cash should be -50 + 500 = 450")

        # 7. Journal Voucher Test (Transfer some cash to partner)
        from finance.models import Partner, JournalVoucher
        partner = Partner.objects.create(tenant=self.tenant, name='Partner 1')
        jv = JournalVoucher.objects.create(
            tenant=self.tenant, amount=Decimal('100.00'), base_amount=Decimal('100.00'),
            dr_account_type='partner', dr_account_id=partner.id,
            cr_account_type='cash', cr_account_id=self.tenant.id,
        )
        LedgerService.record_journal_voucher(jv, user=self.user)
        
        cash_bal_final = LedgerEntry.get_balance(self.tenant, 'cash', self.tenant.id)
        self.assertEqual(cash_bal_final, Decimal('350.000'), "Cash should be 350 after JV transfer")
        partner_bal = LedgerEntry.get_balance(self.tenant, 'partner', partner.id)
        self.assertEqual(partner_bal, Decimal('100.000'), "Partner should have 100 debit balance")

        print("Comprehensive Vegetable Trading Day Test Completed Successfully!")


class JournalVoucherAPITestCase(TestCase):
    def setUp(self):
        from core.models import Currency

        self.client = APIClient()
        self.tenant = Tenant.objects.create(name='Voucher Tenant', subdomain='voucher')
        self.other_tenant = Tenant.objects.create(name='Other Tenant', subdomain='other')
        self.user = CustomUser.objects.create_user(
            username='voucher_admin',
            password='123',
            tenant=self.tenant,
            role='owner',
        )
        self.client.force_authenticate(user=self.user)

        Currency.objects.create(
            tenant=self.tenant,
            code='ILS',
            name='Shekel',
            symbol='NIS',
            is_base=True,
        )
        Currency.objects.create(
            tenant=self.other_tenant,
            code='ILS',
            name='Shekel',
            symbol='NIS',
            is_base=True,
        )

    def test_journal_voucher_api_computes_base_amount_and_posts_balanced_entries(self):
        from finance.models import JournalVoucher, LedgerEntry, Partner

        partner = Partner.objects.create(tenant=self.tenant, name='Partner JV')

        response = self.client.post(
            '/api/journal-vouchers/',
            {
                'currency_code': 'ILS',
                'exchange_rate': '1',
                'amount': '100.000',
                'description': 'Manual voucher',
                'dr_account_type': 'partner',
                'dr_account_id': str(partner.id),
                'cr_account_type': 'cash',
                'cr_account_id': str(self.tenant.id),
            },
            format='json',
            HTTP_HOST='voucher.localhost:8000',
        )

        self.assertEqual(response.status_code, 201)

        voucher = JournalVoucher.objects.get(tenant=self.tenant, description='Manual voucher')
        self.assertEqual(voucher.base_amount, Decimal('100.000'))
        self.assertEqual(voucher.dr_account_name, 'Partner JV')
        self.assertEqual(voucher.cr_account_name, 'cash')

        entries = LedgerEntry.objects.filter(
            tenant=self.tenant,
            reference_type='journal_voucher',
            reference_id=voucher.id,
        )
        self.assertEqual(entries.count(), 2)

        total_dr = sum(
            (entry.base_amount for entry in entries if entry.entry_type == LedgerEntry.DEBIT),
            Decimal('0.000'),
        )
        total_cr = sum(
            (entry.base_amount for entry in entries if entry.entry_type == LedgerEntry.CREDIT),
            Decimal('0.000'),
        )
        self.assertEqual(total_dr, total_cr)

    def test_journal_voucher_api_rejects_same_account_on_both_sides(self):
        response = self.client.post(
            '/api/journal-vouchers/',
            {
                'currency_code': 'ILS',
                'exchange_rate': '1',
                'amount': '50.000',
                'description': 'Invalid voucher',
                'dr_account_type': 'cash',
                'dr_account_id': str(self.tenant.id),
                'cr_account_type': 'cash',
                'cr_account_id': str(self.tenant.id),
            },
            format='json',
            HTTP_HOST='voucher.localhost:8000',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {'non_field_errors': ['Debit and credit accounts cannot be the same.']}
        )

    def test_journal_voucher_api_rejects_cross_tenant_account_reference(self):
        from finance.models import Partner

        foreign_partner = Partner.objects.create(tenant=self.other_tenant, name='Foreign Partner')

        response = self.client.post(
            '/api/journal-vouchers/',
            {
                'currency_code': 'ILS',
                'exchange_rate': '1',
                'amount': '75.000',
                'description': 'Cross tenant voucher',
                'dr_account_type': 'partner',
                'dr_account_id': str(foreign_partner.id),
                'cr_account_type': 'cash',
                'cr_account_id': str(self.tenant.id),
            },
            format='json',
            HTTP_HOST='voucher.localhost:8000',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {'account_id': ['Partner account was not found in this tenant.']}
        )

