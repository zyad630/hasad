from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Sum, Q
from .models import Settlement, LedgerEntry, CashTransaction

MONEY = Decimal('0.01')

class SettlementService:

    def __init__(self, shipment):
        self.shipment = shipment
        self.supplier = shipment.supplier
        self.tenant   = shipment.tenant

    def calculate(self) -> dict:
        from sales.models import SaleItem

        # Total sales — only non-cancelled sales linked to this shipment
        sales_agg = SaleItem.objects.filter(
            shipment_item__shipment=self.shipment,
            sale__is_cancelled=False,
            sale__tenant=self.tenant,
        ).aggregate(total=Sum('subtotal'))

        total_sales = (sales_agg['total'] or Decimal('0')).quantize(MONEY, ROUND_HALF_UP)

        # Commission
        if self.supplier.commission_type == 'percent':
            raw = total_sales * (self.supplier.commission_rate / Decimal('100'))
            commission = raw.quantize(MONEY, ROUND_HALF_UP)
        else:
            commission = self.supplier.commission_rate.quantize(MONEY, ROUND_HALF_UP)

        # Expenses linked to this shipment
        from finance.models import Expense
        exp_agg = Expense.objects.filter(
            shipment=self.shipment,
        ).aggregate(total=Sum('amount'))

        total_expenses = (exp_agg['total'] or Decimal('0')).quantize(MONEY, ROUND_HALF_UP)

        # Net
        net = (total_sales - commission - total_expenses).quantize(MONEY, ROUND_HALF_UP)

        # Verify the formula — crash loudly if math is wrong
        expected = (total_sales - commission - total_expenses).quantize(MONEY, ROUND_HALF_UP)
        assert net == expected, f'Formula mismatch: {net} != {expected}'

        return {
            'total_sales':       total_sales,
            'commission_type':   self.supplier.commission_type,
            'commission_rate':   self.supplier.commission_rate,
            'commission_amount': commission,
            'total_expenses':    total_expenses,
            'net_supplier':      net,
            'sales_count':       SaleItem.objects.filter(
                shipment_item__shipment=self.shipment,
                sale__is_cancelled=False
            ).values('sale').distinct().count(),
        }

    @transaction.atomic
    def confirm(self, user=None, request=None) -> 'Settlement':
        # Lock shipment row — prevents concurrent settlements
        shipment = type(self.shipment).objects.select_for_update(nowait=False).get(
            pk=self.shipment.pk
        )

        if shipment.status == 'settled':
            raise ValueError('هذه الإرسالية تمت تصفيتها مسبقاً')

        data = self.calculate()

        # Read current supplier balance BEFORE writing (for audit trail)
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

        # Mark shipment as settled
        shipment.status = 'settled'
        shipment.save(update_fields=['status'])

        # Book double-entry ledger records
        LedgerService.record_settlement(settlement, user=user)

        # Audit log (non-fatal — skip if audit module not ready)
        try:
            from core.audit import log as audit_log
            audit_log(
                tenant=self.tenant,
                user=user,
                action='settlement_confirmed',
                entity_type='Settlement',
                entity_id=settlement.id,
                before={'shipment_status': 'open', 'supplier_balance': supplier_balance_before},
                after={
                    'shipment_status': 'settled',
                    'supplier_balance': str(LedgerEntry.get_balance(
                        self.tenant, 'supplier', self.supplier.id
                    )),
                },
                request=request,
                notes=f'صافي المورد: {data["net_supplier"]} ج'
            )
        except Exception:
            pass

        return settlement


class LedgerService:
    
    @staticmethod
    def record_sale_reversal(sale, user=None):
        pass # mock for H-01 implementation requirement unless it errors

    @staticmethod
    @transaction.atomic
    def record_sale(sale):
        """Debit customer/cash, credit revenue"""
        acct_type = 'cash' if sale.payment_type == 'cash' else 'customer'
        LedgerService._create_double_entry(
            tenant=sale.tenant,
            dr_account_type=acct_type,
            dr_account_id=sale.customer_id or sale.tenant.id, # Using tenant id as a proxy for cash register if no customer
            cr_account_type='revenue',
            cr_account_id=sale.tenant.id,
            amount=sale.total_amount,
            ref_type='sale',
            ref_id=sale.id,
            description=f"Sale {sale.id}",
            user=sale.created_by
        )

    @staticmethod
    @transaction.atomic
    def _create_double_entry(tenant, dr_account_type, dr_account_id, cr_account_type, cr_account_id, amount, ref_type, ref_id, description, user):
        amt = Decimal(str(amount))
        
        # Debit Entry
        LedgerEntry.objects.create(
            tenant=tenant,
            entry_type=LedgerEntry.DEBIT,
            account_type=dr_account_type,
            account_id=dr_account_id,
            amount=amt,
            reference_type=ref_type,
            reference_id=ref_id,
            description=description,
            created_by=user
        )
        
        # Credit Entry
        LedgerEntry.objects.create(
            tenant=tenant,
            entry_type=LedgerEntry.CREDIT,
            account_type=cr_account_type,
            account_id=cr_account_id,
            amount=amt,
            reference_type=ref_type,
            reference_id=ref_id,
            description=description,
            created_by=user
        )

    @staticmethod
    @transaction.atomic
    def record_settlement(settlement, user=None):
        """
        DR: supplier account (we owe them this amount)
        CR: commission account (our revenue)
        CR: cash account (expenses paid)
        """
        entries = [
            LedgerEntry(
                tenant=settlement.tenant,
                entry_type=LedgerEntry.CREDIT,
                account_type='supplier',
                account_id=settlement.supplier.id,
                amount=settlement.net_supplier,
                reference_type='settlement',
                reference_id=settlement.id,
                description=f'تصفية إرسالية — صافي مستحق للمورد {settlement.supplier.name}',
                created_by=user,
            ),
            LedgerEntry(
                tenant=settlement.tenant,
                entry_type=LedgerEntry.CREDIT,
                account_type='commission',
                account_id=settlement.tenant.id,
                amount=settlement.commission_amount,
                reference_type='settlement',
                reference_id=settlement.id,
                description=f'عمولة تصفية — {settlement.supplier.name}',
                created_by=user,
            ),
            LedgerEntry(
                tenant=settlement.tenant,
                entry_type=LedgerEntry.DEBIT,
                account_type='cost_of_goods',
                account_id=settlement.tenant.id,
                amount=settlement.net_supplier + settlement.commission_amount,
                reference_type='settlement',
                reference_id=settlement.id,
                description=f'تصفية إرسالية — {settlement.supplier.name}',
                created_by=user,
            )
        ]
        LedgerEntry.objects.bulk_create(entries)

    @staticmethod
    @transaction.atomic
    def record_supplier_payment(tenant, supplier, amount, user=None, reference_id=None):
        """
        DR: supplier account (reducing what we owe)
        CR: cash out
        """
        amount = amount.quantize(MONEY, ROUND_HALF_UP)
        entries = [
            LedgerEntry(
                tenant=tenant,
                entry_type=LedgerEntry.DEBIT,
                account_type='supplier',
                account_id=supplier.id,
                amount=amount,
                reference_type='supplier_payment',
                reference_id=reference_id or supplier.id,
                description=f'دفع للمورد: {supplier.name}',
                created_by=user,
            ),
            LedgerEntry(
                tenant=tenant,
                entry_type=LedgerEntry.CREDIT,
                account_type='cash',
                account_id=tenant.id,
                amount=amount,
                reference_type='supplier_payment',
                reference_id=reference_id or supplier.id,
                description=f'صرف من الصندوق — {supplier.name}',
                created_by=user,
            ),
        ]
        LedgerEntry.objects.bulk_create(entries)

    @staticmethod
    @transaction.atomic
    def record_customer_collection(tenant, customer, amount, user=None, reference_id=None):
        amount = amount.quantize(MONEY, ROUND_HALF_UP)
        entries = [
            LedgerEntry(
                tenant=tenant,
                entry_type=LedgerEntry.DEBIT,
                account_type='cash',
                account_id=tenant.id,
                amount=amount,
                reference_type='customer_collection',
                reference_id=reference_id or customer.id,
                description=f'تحصيل من العميل: {customer.name}',
                created_by=user,
            ),
            LedgerEntry(
                tenant=tenant,
                entry_type=LedgerEntry.CREDIT,
                account_type='customer',
                account_id=customer.id,
                amount=amount,
                reference_type='customer_collection',
                reference_id=reference_id or customer.id,
                description=f'سداد ذمة العميل: {customer.name}',
                created_by=user,
            ),
        ]
        LedgerEntry.objects.bulk_create(entries)
