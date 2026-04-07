from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Sum, Q
from .models import Settlement, LedgerEntry, CashTransaction

MONEY = Decimal('0.01')


class SettlementService:
    """
    Handles full settlement of a shipment:
    - Commission via new CommissionType FK (Module 1)
    - Extra costs: plastic, labor, transport (Module 2)  
    - Proper double-entry LedgerEntries for each
    """

    def __init__(self, shipment):
        self.shipment = shipment
        self.supplier = shipment.supplier
        self.tenant   = shipment.tenant

    def calculate(self) -> dict:
        from sales.models import SaleItem
        from inventory.models import ShipmentItem

        # ── Total sales for this shipment ───────────────────────────────────
        sales_agg = SaleItem.objects.filter(
            shipment_item__shipment=self.shipment,
            sale__is_cancelled=False,
            sale__tenant=self.tenant,
        ).aggregate(total=Sum('subtotal'))
        total_sales = (sales_agg['total'] or Decimal('0')).quantize(MONEY, ROUND_HALF_UP)

        # ── Commission via CommissionType FK (Module 1 fix) ─────────────────
        ct = self.supplier.commission_type
        if ct:
            if ct.calc_type == 'percent':
                commission = (total_sales * (ct.default_rate / Decimal('100'))).quantize(MONEY, ROUND_HALF_UP)
            else:
                commission = ct.default_rate.quantize(MONEY, ROUND_HALF_UP)
        else:
            commission = Decimal('0.00')

        # ── Module 2: Extra costs per ShipmentItem ──────────────────────────
        items_agg = ShipmentItem.objects.filter(shipment=self.shipment).aggregate(
            total_plastic=Sum('plastic_cost'),
            total_labor=Sum('labor_cost'),
            total_transport=Sum('transport_cost'),
        )
        plastic_cost   = (items_agg['total_plastic']   or Decimal('0')).quantize(MONEY, ROUND_HALF_UP)
        labor_cost     = (items_agg['total_labor']     or Decimal('0')).quantize(MONEY, ROUND_HALF_UP)
        transport_cost = (items_agg['total_transport'] or Decimal('0')).quantize(MONEY, ROUND_HALF_UP)

        # Existing generic expenses (linked to shipment)
        from finance.models import Expense
        exp_agg = Expense.objects.filter(shipment=self.shipment).aggregate(total=Sum('amount'))
        generic_expenses = (exp_agg['total'] or Decimal('0')).quantize(MONEY, ROUND_HALF_UP)

        total_expenses = (plastic_cost + labor_cost + transport_cost + generic_expenses).quantize(MONEY, ROUND_HALF_UP)

        # ── Net for supplier ────────────────────────────────────────────────
        net = (total_sales - commission - total_expenses).quantize(MONEY, ROUND_HALF_UP)

        return {
            'total_sales':       total_sales,
            'commission_type':   ct.calc_type if ct else 'none',
            'commission_rate':   float(ct.default_rate) if ct else 0,
            'commission_amount': commission,
            'plastic_cost':      plastic_cost,
            'labor_cost':        labor_cost,
            'transport_cost':    transport_cost,
            'generic_expenses':  generic_expenses,
            'total_expenses':    total_expenses,
            'net_supplier':      net,
            'sales_count': SaleItem.objects.filter(
                shipment_item__shipment=self.shipment,
                sale__is_cancelled=False,
            ).values('sale').distinct().count(),
        }

    @transaction.atomic
    def confirm(self, user=None, request=None) -> 'Settlement':
        # Lock shipment row
        shipment = type(self.shipment).objects.select_for_update(nowait=False).get(pk=self.shipment.pk)

        if shipment.status == 'settled':
            raise ValueError('هذه الإرسالية تمت تصفيتها مسبقاً')

        data = self.calculate()

        try:
            supplier_balance_before = str(self.supplier.balance)
        except AttributeError:
            supplier_balance_before = '0.00'

        settlement = Settlement.objects.create(
            tenant=self.tenant,
            shipment=shipment,
            supplier=self.supplier,
            total_sales=data['total_sales'],
            commission_amount=data['commission_amount'],
            total_expenses=data['total_expenses'],
            net_supplier=data['net_supplier'],
        )

        shipment.status = 'settled'
        shipment.save(update_fields=['status'])

        # Book all double-entry ledger records (Module 1 + Module 2 expenses)
        LedgerService.record_settlement(settlement, data=data, user=user)

        try:
            from core.audit import log as audit_log
            audit_log(
                tenant=self.tenant, user=user,
                action='settlement_confirmed',
                entity_type='Settlement', entity_id=settlement.id,
                before={'shipment_status': 'open', 'supplier_balance': supplier_balance_before},
                after={
                    'shipment_status': 'settled',
                    'supplier_balance': str(LedgerEntry.get_balance(self.tenant, 'supplier', self.supplier.id)),
                },
                request=request,
                notes=f'صافي المورد: {data["net_supplier"]} ج',
            )
        except Exception:
            pass

        return settlement


class LedgerService:

    @staticmethod
    def record_sale_reversal(sale, user=None):
        pass  # Placeholder for H-01 — reversal handled in SaleViewSet

    @staticmethod
    @transaction.atomic
    def record_sale(sale):
        """DR customer/cash → CR revenue"""
        acct_type = 'cash' if sale.payment_type == 'cash' else 'customer'
        LedgerService._double_entry(
            tenant=sale.tenant,
            dr_type=acct_type, dr_id=sale.customer_id or sale.tenant.id,
            cr_type='revenue',   cr_id=sale.tenant.id,
            amount=sale.total_amount,
            ref_type='sale', ref_id=sale.id,
            description=f'فاتورة بيع #{sale.id}',
            user=sale.created_by,
        )

    @staticmethod
    @transaction.atomic
    def record_settlement(settlement, data: dict, user=None):
        """
        Full settlement double-entry:
        1. CR supplier  → net_supplier (what we owe farmer)
        2. CR commission revenue → commission_amount
        3. DR cost_of_goods  → total debit side
        4. CR plastic_expense  (Module 2)
        5. CR labor_expense    (Module 2)
        6. CR transport_expense (Module 2)
        """
        entries = []
        sid = settlement.id
        tenant = settlement.tenant
        name = settlement.supplier.name

        # 1. Credit supplier (what we owe them net)
        entries.append(LedgerEntry(
            tenant=tenant, entry_type=LedgerEntry.CREDIT,
            account_type='supplier', account_id=settlement.supplier.id,
            amount=settlement.net_supplier,
            reference_type='settlement', reference_id=sid,
            description=f'تصفية إرسالية — صافي مستحق للمورد {name}',
            created_by=user,
        ))

        # 2. Credit commission revenue
        entries.append(LedgerEntry(
            tenant=tenant, entry_type=LedgerEntry.CREDIT,
            account_type='commission_revenue', account_id=tenant.id,
            amount=settlement.commission_amount,
            reference_type='settlement', reference_id=sid,
            description=f'عمولة تصفية — {name}',
            created_by=user,
        ))

        # 3. Debit cost-of-goods (total of sales revenue)
        entries.append(LedgerEntry(
            tenant=tenant, entry_type=LedgerEntry.DEBIT,
            account_type='cost_of_goods', account_id=tenant.id,
            amount=settlement.total_sales,
            reference_type='settlement', reference_id=sid,
            description=f'تصفية — تكلفة البضاعة من {name}',
            created_by=user,
        ))

        # 4–6. Module 2: Extra cost entries (CR expense accounts)
        cost_map = [
            ('plastic_cost',   'plastic_expense',   'بلاستيك'),
            ('labor_cost',     'labor_expense',     'عتالة'),
            ('transport_cost', 'transport_expense', 'نقل'),
        ]
        for key, acct, label in cost_map:
            amount = data.get(key, Decimal('0'))
            if amount and amount > 0:
                # Debit expense account
                entries.append(LedgerEntry(
                    tenant=tenant, entry_type=LedgerEntry.DEBIT,
                    account_type=acct, account_id=tenant.id,
                    amount=amount,
                    reference_type='settlement', reference_id=sid,
                    description=f'مصروف {label} — {name}',
                    created_by=user,
                ))
                # Credit supplier (deducted from their net)
                entries.append(LedgerEntry(
                    tenant=tenant, entry_type=LedgerEntry.CREDIT,
                    account_type='supplier', account_id=settlement.supplier.id,
                    amount=amount,
                    reference_type='settlement', reference_id=sid,
                    description=f'خصم {label} من مستحقات {name}',
                    created_by=user,
                ))

        LedgerEntry.objects.bulk_create(entries)

    @staticmethod
    @transaction.atomic
    def record_supplier_payment(tenant, supplier, amount, user=None, reference_id=None):
        """DR supplier → CR cash (paying the farmer)"""
        amount = Decimal(str(amount)).quantize(MONEY, ROUND_HALF_UP)
        LedgerService._double_entry(
            tenant=tenant,
            dr_type='supplier', dr_id=supplier.id,
            cr_type='cash',     cr_id=tenant.id,
            amount=amount,
            ref_type='supplier_payment', ref_id=reference_id or supplier.id,
            description=f'دفع للمورد: {supplier.name}',
            user=user,
        )

    @staticmethod
    @transaction.atomic
    def record_customer_collection(tenant, customer, amount, user=None, reference_id=None):
        """DR cash → CR customer (collecting from trader)"""
        amount = Decimal(str(amount)).quantize(MONEY, ROUND_HALF_UP)
        LedgerService._double_entry(
            tenant=tenant,
            dr_type='cash',     dr_id=tenant.id,
            cr_type='customer', cr_id=customer.id,
            amount=amount,
            ref_type='customer_collection', ref_id=reference_id or customer.id,
            description=f'سداد ذمة العميل: {customer.name}',
            user=user,
        )

    # ── Module 5: Returns ──────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def record_sale_return(sale_return, user=None):
        """Reverse the original sale entries."""
        orig = sale_return.original_sale
        LedgerService._double_entry(
            tenant=orig.tenant,
            dr_type='revenue',   dr_id=orig.tenant.id,
            cr_type='customer' if orig.payment_type == 'credit' else 'cash',
            cr_id=orig.customer_id or orig.tenant.id,
            amount=sale_return.return_amount,
            ref_type='sale_return', ref_id=sale_return.id,
            description=f'مرتجع مبيعات — فاتورة #{orig.id}',
            user=user,
        )

    @staticmethod
    @transaction.atomic
    def record_salary_payment(payroll_line, user=None):
        """DR salary_expense → CR cash (Module 6)"""
        amt = Decimal(str(payroll_line.net_salary)).quantize(MONEY, ROUND_HALF_UP)
        LedgerService._double_entry(
            tenant=payroll_line.payroll_run.tenant,
            dr_type='salary_expense',  dr_id=payroll_line.payroll_run.tenant.id,
            cr_type='cash',            cr_id=payroll_line.payroll_run.tenant.id,
            amount=amt,
            ref_type='payroll', ref_id=payroll_line.id,
            description=f'راتب {payroll_line.employee.name} — {payroll_line.payroll_run.run_date}',
            user=user,
        )

    @staticmethod
    @transaction.atomic
    def record_check_deposit(check_obj, user=None):
        """Module 7: DR bank_account → CR checks_wallet (on deposit)"""
        LedgerService._double_entry(
            tenant=check_obj.tenant,
            dr_type='bank_account', dr_id=check_obj.tenant.id,
            cr_type='checks_wallet', cr_id=check_obj.tenant.id,
            amount=check_obj.amount,
            ref_type='check', ref_id=check_obj.id,
            description=f'إيداع شيك #{check_obj.check_number} — {check_obj.bank_name}',
            user=user,
        )

    @staticmethod
    @transaction.atomic
    def record_check_bounce(check_obj, user=None):
        """Module 7: Reverse deposit — DR checks_wallet → CR bank_account"""
        LedgerService._double_entry(
            tenant=check_obj.tenant,
            dr_type='checks_wallet', dr_id=check_obj.tenant.id,
            cr_type='bank_account',  cr_id=check_obj.tenant.id,
            amount=check_obj.amount,
            ref_type='check_bounce', ref_id=check_obj.id,
            description=f'شيك مرتجع #{check_obj.check_number} — {check_obj.bank_name}',
            user=user,
        )

    # ── Shared helper ──────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def _double_entry(tenant, dr_type, dr_id, cr_type, cr_id, amount, ref_type, ref_id, description, user):
        amt = Decimal(str(amount)).quantize(MONEY, ROUND_HALF_UP)
        LedgerEntry.objects.bulk_create([
            LedgerEntry(
                tenant=tenant, entry_type=LedgerEntry.DEBIT,
                account_type=dr_type, account_id=dr_id,
                amount=amt, reference_type=ref_type, reference_id=ref_id,
                description=description, created_by=user,
            ),
            LedgerEntry(
                tenant=tenant, entry_type=LedgerEntry.CREDIT,
                account_type=cr_type, account_id=cr_id,
                amount=amt, reference_type=ref_type, reference_id=ref_id,
                description=description, created_by=user,
            ),
        ])
