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

        ct = self.supplier.commission_type

        # ── Commission via POS specific rates (Module 1 fix - Integrated) ──
        # Sum commission amounts for each sale item
        sale_items = SaleItem.objects.filter(
            shipment_item__shipment=self.shipment,
            sale__is_cancelled=False,
            sale__tenant=self.tenant,
        )
        
        commission = Decimal('0.00')
        total_sales = Decimal('0.00')
        
        for si in sale_items:
            total_sales += si.subtotal
            
            # If a specific rate was recorded at POS (not 0), use it
            if si.commission_rate and si.commission_rate > 0:
                # Assuming commission_rate in POS is percentage
                commission += (si.subtotal * (si.commission_rate / Decimal('100')))
            else:
                # Fallback to supplier default
                if ct:
                    if ct.calc_type == 'percent':
                        commission += (si.subtotal * (ct.default_rate / Decimal('100')))
                    else:
                        # Fixed amount per line as a fallback
                        commission += ct.default_rate
        
        commission = commission.quantize(MONEY, ROUND_HALF_UP)
        total_sales = total_sales.quantize(MONEY, ROUND_HALF_UP)

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
        exp_agg = Expense.objects.filter(shipment=self.shipment).aggregate(total=Sum('base_amount'))
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
        self._validate_confirmation_data(data)

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

    def _validate_confirmation_data(self, data: dict) -> None:
        fields_to_check = (
            'total_sales',
            'commission_amount',
            'plastic_cost',
            'labor_cost',
            'transport_cost',
            'generic_expenses',
            'total_expenses',
        )
        for field in fields_to_check:
            if Decimal(str(data.get(field, 0))) < Decimal('0'):
                raise ValueError(f'Invalid negative settlement value: {field}')

        if Decimal(str(data.get('total_sales', 0))) <= Decimal('0'):
            raise ValueError('لا يمكن تصفية إرسالية بدون مبيعات')


class LedgerService:

    @staticmethod
    @transaction.atomic
    def record_sale_reversal(sale, user=None):
        """CR customer/cash → DR revenue (Reverse the original sale)"""
        acct_type = 'cash' if sale.payment_type == 'cash' else 'customer'
        LedgerService._double_entry(
            tenant=sale.tenant,
            dr_type='revenue',   dr_id=sale.tenant.id,
            cr_type=acct_type,   cr_id=sale.customer_id or sale.tenant.id,
            amount=sale.foreign_amount,
            exchange_rate=sale.exchange_rate,
            currency_code=getattr(sale, 'currency_code', 'ILS'),
            ref_type='sale_reversal', ref_id=sale.id,
            description=f'إلغاء فاتورة بيع #{sale.id}',
            user=user,
        )

    @staticmethod
    @transaction.atomic
    def record_sale(sale):
        """DR customer/cash → CR revenue"""
        acct_type = 'cash' if sale.payment_type == 'cash' else 'customer'
        LedgerService._double_entry(
            tenant=sale.tenant,
            dr_type=acct_type, dr_id=sale.customer_id or sale.tenant.id,
            cr_type='revenue',   cr_id=sale.tenant.id,
            amount=sale.foreign_amount,
            exchange_rate=sale.exchange_rate,
            currency_code=getattr(sale, 'currency_code', 'ILS'),
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
        total_sales = Decimal(str(settlement.total_sales)).quantize(MONEY, ROUND_HALF_UP)

        entries.append(LedgerEntry(
            tenant=tenant, entry_type=LedgerEntry.DEBIT,
            account_type='cost_of_goods', account_id=tenant.id,
            foreign_amount=total_sales, base_amount=total_sales, exchange_rate=1, currency_code=settlement.currency_code,
            reference_type='settlement', reference_id=sid,
            description=f'تصفية إرسالية — إثبات تكلفة بضاعة للمزارع: {name}',
            created_by=user,
        ))
        entries.append(LedgerEntry(
            tenant=tenant, entry_type=LedgerEntry.CREDIT,
            account_type='supplier', account_id=settlement.supplier.id,
            foreign_amount=total_sales, base_amount=total_sales, exchange_rate=1, currency_code=settlement.currency_code,
            reference_type='settlement', reference_id=sid,
            description=f'تصفية إرسالية — إجمالي مستحق للمزارع قبل الخصومات: {name}',
            created_by=user,
        ))

        deduction_map = [
            ('commission_amount', 'commission_revenue', 'العمولة'),
            ('plastic_cost', 'plastic_expense', 'البلاستيك'),
            ('labor_cost', 'labor_expense', 'العتالة'),
            ('transport_cost', 'transport_expense', 'النقل'),
            ('generic_expenses', 'general_expense', 'مصاريف عامة'),
        ]
        for key, acct, label in deduction_map:
            amount = Decimal(str(data.get(key, 0) or 0)).quantize(MONEY, ROUND_HALF_UP)
            if amount > 0:
                entries.append(LedgerEntry(
                    tenant=tenant, entry_type=LedgerEntry.DEBIT,
                    account_type='supplier', account_id=settlement.supplier.id,
                    foreign_amount=amount, base_amount=amount, exchange_rate=1, currency_code=settlement.currency_code,
                    reference_type='settlement', reference_id=sid,
                    description=f'تصفية إرسالية — خصم {label} من مستحقات المزارع: {name}',
                    created_by=user,
                ))
                entries.append(LedgerEntry(
                    tenant=tenant, entry_type=LedgerEntry.CREDIT,
                    account_type=acct, account_id=tenant.id,
                    foreign_amount=amount, base_amount=amount, exchange_rate=1, currency_code=settlement.currency_code,
                    reference_type='settlement', reference_id=sid,
                    description=f'تصفية إرسالية — تسجيل بند {label} (مخصوم من {name})',
                    created_by=user,
                ))

        LedgerService._validate_balanced_entries(entries)
        LedgerEntry.objects.bulk_create(entries)

    @staticmethod
    @transaction.atomic
    def record_partner_initial_capital(partner, user=None):
        """DR cash → CR partner (initial capital injection)"""
        if partner.initial_capital <= 0:
            return
            
        LedgerService._double_entry(
            tenant=partner.tenant,
            dr_type='cash',     dr_id=partner.tenant.id,
            cr_type='partner',  cr_id=partner.id,
            amount=partner.initial_capital,
            currency_code='ILS',
            ref_type='partner_capital', ref_id=partner.id,
            description=f'رأس مال مبدئي - الشريك: {partner.name}',
            user=user,
        )

    @staticmethod
    @transaction.atomic
    def record_supplier_payment(tenant, supplier, amount, user=None, reference_id=None, currency_code='ILS'):
        """DR supplier → CR cash (paying the farmer)"""
        amount = Decimal(str(amount)).quantize(MONEY, ROUND_HALF_UP)
        LedgerService._double_entry(
            tenant=tenant,
            dr_type='supplier', dr_id=supplier.id,
            cr_type='cash',     cr_id=tenant.id,
            amount=amount,
            currency_code=currency_code,
            ref_type='supplier_payment', ref_id=reference_id or supplier.id,
            description=f'دفع للمورد: {supplier.name}',
            user=user,
        )

    @staticmethod
    @transaction.atomic
    def record_general_expense(expense, user=None):
        """DR general_expense → CR cash (Manual expense entry)"""
        LedgerService._double_entry(
            tenant=expense.tenant,
            dr_type='general_expense', dr_id=expense.category.id if expense.category else expense.tenant.id,
            cr_type='cash',            cr_id=expense.tenant.id,
            amount=expense.foreign_amount,
            exchange_rate=expense.exchange_rate,
            currency_code=expense.currency_code,
            ref_type='general_expense', ref_id=expense.id,
            description=expense.description or f"مصروف: {expense.category.name if expense.category else 'عام'}",
            user=user,
        )

    @staticmethod
    @transaction.atomic
    def record_customer_collection(tenant, customer, amount, user=None, reference_id=None, currency_code='ILS'):
        """DR cash → CR customer (collecting from trader)"""
        amount = Decimal(str(amount)).quantize(MONEY, ROUND_HALF_UP)
        LedgerService._double_entry(
            tenant=tenant,
            dr_type='cash',     dr_id=tenant.id,
            cr_type='customer', cr_id=customer.id,
            amount=amount,
            currency_code=currency_code,
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
            currency_code=getattr(orig, 'currency_code', 'ILS'),
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
            currency_code=getattr(payroll_line.payroll_run.tenant, 'base_currency_code', 'ILS'),
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
            amount=check_obj.foreign_amount,
            exchange_rate=check_obj.exchange_rate,
            currency_code=getattr(check_obj, 'currency_code', 'ILS'),
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
            amount=check_obj.foreign_amount,
            exchange_rate=check_obj.exchange_rate,
            currency_code=getattr(check_obj, 'currency_code', 'ILS'),
            ref_type='check_bounce', ref_id=check_obj.id,
            description=f'شيك مرتجع #{check_obj.check_number} — {check_obj.bank_name}',
            user=user,
        )

    # ── Shared helper ──────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def _double_entry(tenant, dr_type, dr_id, cr_type, cr_id, amount, ref_type, ref_id, description, user, currency_code='ILS', exchange_rate=1):
        amt = Decimal(str(amount)).quantize(Decimal('0.001'), ROUND_HALF_UP)
        xr = Decimal(str(exchange_rate))
        base_amt = (amt * xr).quantize(Decimal('0.001'), ROUND_HALF_UP)

        LedgerEntry.objects.bulk_create([
            LedgerEntry(
                tenant=tenant, entry_type=LedgerEntry.DEBIT,
                currency_code=currency_code, exchange_rate=xr,
                account_type=dr_type, account_id=dr_id,
                foreign_amount=amt, base_amount=base_amt, 
                reference_type=ref_type, reference_id=ref_id,
                description=description, created_by=user,
            ),
            LedgerEntry(
                tenant=tenant, entry_type=LedgerEntry.CREDIT,
                currency_code=currency_code, exchange_rate=xr,
                account_type=cr_type, account_id=cr_id,
                foreign_amount=amt, base_amount=base_amt,
                reference_type=ref_type, reference_id=ref_id,
                description=description, created_by=user,
            ),
        ])

    @staticmethod
    def _validate_balanced_entries(entries):
        total_dr = sum(
            (entry.base_amount for entry in entries if entry.entry_type == LedgerEntry.DEBIT),
            Decimal('0.000')
        )
        total_cr = sum(
            (entry.base_amount for entry in entries if entry.entry_type == LedgerEntry.CREDIT),
            Decimal('0.000')
        )
        if total_dr != total_cr:
            raise ValueError(f'Unbalanced ledger entries: DR={total_dr} CR={total_cr}')

    # ─── BRD: Automatic Exchange Rate Difference (Forex Gain / Loss) ───────────

    @staticmethod
    @transaction.atomic
    def record_forex_adjustment(tenant, account_type, account_id, currency_code,
                                 original_rate, new_rate, foreign_balance, ref_id, user=None):
        """
        Creates an automatic adjustment journal entry when the exchange rate changes,
        booking the difference as Forex Gain or Forex Loss.

        Example (BRD requirement):
          Customer owes us JOD 1,000 @ 3.85 ILS → booked as ILS 3,850
          Rate changes to 3.90 → revalued at ILS 3,900
          Difference = ILS 50 GAIN → book DR customer / CR forex_gain

        Args:
            original_rate:    the rate when the transaction was initially booked
            new_rate:         the new (current) exchange rate
            foreign_balance:  the open balance in the foreign currency to revalue
        """
        orig = Decimal(str(original_rate)).quantize(Decimal('0.000001'), ROUND_HALF_UP)
        curr = Decimal(str(new_rate)).quantize(Decimal('0.000001'), ROUND_HALF_UP)
        fbal = Decimal(str(foreign_balance)).quantize(Decimal('0.001'), ROUND_HALF_UP)

        if orig == curr or fbal == Decimal('0'):
            return None  # No adjustment needed

        old_base = (fbal * orig).quantize(Decimal('0.001'), ROUND_HALF_UP)
        new_base = (fbal * curr).quantize(Decimal('0.001'), ROUND_HALF_UP)
        diff = (new_base - old_base).quantize(Decimal('0.001'), ROUND_HALF_UP)

        if diff == Decimal('0'):
            return None

        is_gain = diff > Decimal('0')
        abs_diff = abs(diff)

        if account_type == 'customer':
            # Customer owes us → if rate goes up → we gain more ILS
            if is_gain:
                dr_type, cr_type = account_type, 'forex_gain'
            else:
                dr_type, cr_type = 'forex_loss', account_type
        else:
            # Supplier we owe → if rate goes up → we owe more ILS (loss)
            if is_gain:
                dr_type, cr_type = 'forex_loss', account_type
            else:
                dr_type, cr_type = account_type, 'forex_gain'

        adj_desc = (
            f'فرق سعر صرف {currency_code}: من {orig} → {curr} | '
            f'رصيد {fbal} {currency_code} | '
            f'{"مكسب" if is_gain else "خسارة"} صرف: {abs_diff} ₪'
        )

        LedgerService._double_entry(
            tenant=tenant,
            dr_type=dr_type, dr_id=account_id,
            cr_type=cr_type, cr_id=account_id,
            amount=abs_diff,
            exchange_rate=1,  # Adjustment is already in ILS
            currency_code='ILS',
            ref_type='forex_adjustment',
            ref_id=ref_id,
            description=adj_desc,
            user=user,
        )
        return diff

    @staticmethod
    @transaction.atomic
    def record_journal_voucher(voucher, user=None):
        """
        Record a pure manual Journal Voucher between any two accounts.
        DR account_type (id) -> CR account_type (id)
        """
        if Decimal(str(voucher.amount)) <= Decimal('0'):
            raise ValueError('Journal voucher amount must be greater than zero.')
        if (
            str(voucher.dr_account_type) == str(voucher.cr_account_type) and
            str(voucher.dr_account_id) == str(voucher.cr_account_id)
        ):
            raise ValueError('Debit and credit accounts cannot be the same.')

        LedgerService._double_entry(
            tenant=voucher.tenant,
            dr_type=voucher.dr_account_type, 
            dr_id=voucher.dr_account_id,
            cr_type=voucher.cr_account_type, 
            cr_id=voucher.cr_account_id,
            amount=voucher.amount,
            exchange_rate=voucher.exchange_rate,
            currency_code=voucher.currency_code,
            ref_type='journal_voucher', 
            ref_id=voucher.id,
            description=voucher.description or f'مستند قيد رقم {voucher.id}',
            user=user,
        )
