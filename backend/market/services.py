from django.db import transaction
from decimal import Decimal, ROUND_HALF_UP
from finance.models import CashTransaction, CashTxType, Check
from finance.services import LedgerService

MONEY = Decimal('0.001')


class DailyMovementService:
    @staticmethod
    @transaction.atomic
    def process_movement(movement, checks_details=None):
        """
        Processes financial flows for a daily movement with FULL double-entry integrity.
        Every debit has a matching credit. No orphan LedgerEntry records.
        """
        tenant = movement.tenant
        supplier = movement.supplier
        buyer = movement.buyer
        currency_code = movement.currency.code
        exchange_rate = Decimal('1')

        # ────────────── 1. Supplier Side (المزارع) ──────────────
        # CR supplier: purchase_total (we owe the farmer for their goods)
        # DR cost_of_goods: purchase_total (cost of goods sold)
        purchase_total = Decimal(str(movement.purchase_total)).quantize(MONEY, ROUND_HALF_UP)

        LedgerService._double_entry(
            tenant=tenant,
            dr_type='cost_of_goods', dr_id=tenant.id,
            cr_type='supplier', cr_id=supplier.id,
            amount=purchase_total,
            currency_code=currency_code,
            exchange_rate=exchange_rate,
            ref_type='market_tx', ref_id=movement.id,
            description=f"مشتريات {movement.item_name} (إجمالي) - حركة #{movement.daily_seq}",
            user=None,
        )

        # Deductions from supplier (DR supplier, CR various revenue/expense accounts)
        deductions = [
            (movement.commission_amount, "commission_revenue", "عمولة مزارع"),
            (movement.unloading_fee, "revenue", "رسوم تنزيل"),
            (movement.floor_fee, "revenue", "رسوم أرضية"),
        ]
        for val, acct_type, label in deductions:
            amount = Decimal(str(val)).quantize(MONEY, ROUND_HALF_UP)
            if amount > 0:
                LedgerService._double_entry(
                    tenant=tenant,
                    dr_type='supplier', dr_id=supplier.id,
                    cr_type=acct_type, cr_id=tenant.id,
                    amount=amount,
                    currency_code=currency_code,
                    exchange_rate=exchange_rate,
                    ref_type='market_tx', ref_id=movement.id,
                    description=f"خصم {label} - حركة #{movement.daily_seq}",
                    user=None,
                )

        # ────────────── 2. Buyer Side (المشتري) ──────────────
        if buyer and movement.sale_total > 0:
            sale_total = Decimal(str(movement.sale_total)).quantize(MONEY, ROUND_HALF_UP)
            # DR customer (they owe us), CR revenue (we earned it)
            LedgerService._double_entry(
                tenant=tenant,
                dr_type='customer', dr_id=buyer.id,
                cr_type='revenue', cr_id=tenant.id,
                amount=sale_total,
                currency_code=currency_code,
                exchange_rate=exchange_rate,
                ref_type='market_tx', ref_id=movement.id,
                description=f"مبيعات {movement.item_name} (شاملة الرسوم) - حركة #{movement.daily_seq}",
                user=None,
            )

        # ────────────── 3. Cash Flow - Payments ──────────────
        # Cash Received from Buyer
        if movement.cash_received > 0 and buyer:
            cash_amt = Decimal(str(movement.cash_received)).quantize(MONEY, ROUND_HALF_UP)
            CashTransaction.objects.create(
                tenant=tenant, tx_type=CashTxType.IN, currency_code=currency_code,
                foreign_amount=cash_amt, base_amount=cash_amt, exchange_rate=1,
                reference_type='market_tx', reference_id=movement.id,
                description=f"قبض نقدي من {buyer.name} - سطر #{movement.daily_seq}"
            )
            # DR cash, CR customer (buyer paid us)
            LedgerService._double_entry(
                tenant=tenant,
                dr_type='cash', dr_id=tenant.id,
                cr_type='customer', cr_id=buyer.id,
                amount=cash_amt,
                currency_code=currency_code,
                exchange_rate=exchange_rate,
                ref_type='market_tx', ref_id=movement.id,
                description=f"دفعة نقدية - سطر #{movement.daily_seq}",
                user=None,
            )

        # Check Flow - Checks Received
        if checks_details and buyer:
            for chk in checks_details:
                try:
                    chk_amount = Decimal(str(chk.get('amount', 0))).quantize(MONEY, ROUND_HALF_UP)
                except Exception:
                    chk_amount = Decimal('0')

                if chk_amount <= 0 or not chk.get('check_number'):
                    continue

                check_obj = Check.objects.create(
                    tenant=tenant, daily_movement=movement,
                    check_number=chk.get('check_number'), bank_name=chk.get('bank_name', 'غير محدد'),
                    due_date=chk.get('due_date'), base_amount=chk_amount, foreign_amount=chk_amount,
                    currency_code=currency_code, drawer_name=buyer.name
                )
                CashTransaction.objects.create(
                    tenant=tenant, tx_type=CashTxType.IN, currency_code=currency_code,
                    foreign_amount=chk_amount, base_amount=chk_amount, exchange_rate=1, is_check=True, check_ref=check_obj,
                    reference_type='market_tx', reference_id=movement.id,
                    description=f"قبض شيك رقم {chk.get('check_number')} - سطر #{movement.daily_seq}"
                )
                # DR checks_wallet, CR customer
                LedgerService._double_entry(
                    tenant=tenant,
                    dr_type='checks_wallet', dr_id=tenant.id,
                    cr_type='customer', cr_id=buyer.id,
                    amount=chk_amount,
                    currency_code=currency_code,
                    exchange_rate=exchange_rate,
                    ref_type='market_tx', ref_id=movement.id,
                    description=f"تحصيل شيك رقم {chk.get('check_number')} - سطر #{movement.daily_seq}",
                    user=None,
                )

        # Cash Flow - Expense Amount (Payment to Supplier)
        if movement.expense_amount > 0:
            expense_amt = Decimal(str(movement.expense_amount)).quantize(MONEY, ROUND_HALF_UP)
            CashTransaction.objects.create(
                tenant=tenant, tx_type=CashTxType.OUT, currency_code=currency_code,
                foreign_amount=expense_amt, base_amount=expense_amt, exchange_rate=1,
                reference_type='market_tx', reference_id=movement.id,
                description=f"دفع للمزارع {supplier.name} - سطر #{movement.daily_seq}"
            )
            # DR supplier (reducing what we owe), CR cash
            LedgerService._double_entry(
                tenant=tenant,
                dr_type='supplier', dr_id=supplier.id,
                cr_type='cash', cr_id=tenant.id,
                amount=expense_amt,
                currency_code=currency_code,
                exchange_rate=exchange_rate,
                ref_type='market_tx', ref_id=movement.id,
                description=f"دفعة نقدية للمزارع - سطر #{movement.daily_seq}",
                user=None,
            )
