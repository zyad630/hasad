from django.db import transaction
from decimal import Decimal
from finance.models import CashTransaction, LedgerEntry, CashTxType, Check

class DailyMovementService:
    @staticmethod
    @transaction.atomic
    def process_movement(movement, checks_details=None):
        """
        Processes financial flows for a daily movement.
        """
        tenant = movement.tenant
        supplier = movement.supplier
        buyer = movement.buyer
        
        # 1. Supplier Side: Ledger Entry for Purchase
        net_to_supplier = movement.purchase_total - movement.commission_amount
        if net_to_supplier > 0:
            LedgerEntry.objects.create(
                tenant=tenant, account_type='supplier', account_id=supplier.id,
                currency_code=movement.currency.code, entry_type='CR', 
                foreign_amount=net_to_supplier, base_amount=net_to_supplier, exchange_rate=1,
                reference_type='market_tx', reference_id=movement.id,
                description=f"مشتريات {movement.item_name} - حركة #{movement.daily_seq}"
            )

        # 2. Buyer Side: Ledger Entry for Sale
        if buyer and movement.sale_total > 0:
            LedgerEntry.objects.create(
                tenant=tenant, account_type='customer', account_id=buyer.id,
                currency_code=movement.currency.code, entry_type='DR', 
                foreign_amount=movement.sale_total, base_amount=movement.sale_total, exchange_rate=1,
                reference_type='market_tx', reference_id=movement.id,
                description=f"مبيعات {movement.item_name} - حركة #{movement.daily_seq}"
            )

        # 3. Cash Flow - Cash Received (Customer Payment)
        if movement.cash_received > 0 and buyer:
            CashTransaction.objects.create(
                tenant=tenant, tx_type=CashTxType.IN, currency_code=movement.currency.code,
                foreign_amount=movement.cash_received, base_amount=movement.cash_received, exchange_rate=1,
                reference_type='market_tx', reference_id=movement.id,
                description=f"قبض نقدي من {buyer.name} - سطر #{movement.daily_seq}"
            )
            LedgerEntry.objects.create(
                tenant=tenant, account_type='customer', account_id=buyer.id,
                currency_code=movement.currency.code, entry_type='CR', 
                foreign_amount=movement.cash_received, base_amount=movement.cash_received, exchange_rate=1,
                reference_type='market_tx', reference_id=movement.id,
                description=f"دفعة نقدية - سطر #{movement.daily_seq}"
            )

        # 4. Check Flow - Checks Received (Customer Payment)
        if checks_details and buyer:
            for chk in checks_details:
                # Safely convert amount to Decimal (frontend may send strings)
                try:
                    chk_amount = Decimal(str(chk.get('amount', 0)))
                except Exception:
                    chk_amount = Decimal('0')

                if chk_amount <= 0:
                    continue  # Skip invalid checks

                if not chk.get('check_number') or not chk.get('bank_name') or not chk.get('due_date'):
                    continue  # Skip incomplete checks

                check_obj = Check.objects.create(
                    tenant=tenant,
                    daily_movement=movement,
                    check_number=chk.get('check_number'),
                    bank_name=chk.get('bank_name'),
                    due_date=chk.get('due_date'),
                    amount=chk_amount,
                    currency_code=movement.currency.code,
                    drawer_name=buyer.name
                )
                # Create CashTransaction for check
                CashTransaction.objects.create(
                    tenant=tenant, tx_type=CashTxType.IN, currency_code=movement.currency.code,
                    foreign_amount=chk_amount, base_amount=chk_amount, exchange_rate=1, is_check=True, check_ref=check_obj,
                    reference_type='market_tx', reference_id=movement.id,
                    description=f"قبض شيك رقم {chk.get('check_number')} - سطر #{movement.daily_seq}"
                )
                # Credit the buyer ledger
                LedgerEntry.objects.create(
                    tenant=tenant, account_type='customer', account_id=buyer.id,
                    currency_code=movement.currency.code, entry_type='CR', 
                    foreign_amount=chk_amount, base_amount=chk_amount, exchange_rate=1,
                    reference_type='market_tx', reference_id=movement.id,
                    description=f"تحصيل شيك رقم {chk.get('check_number')} - سطر #{movement.daily_seq}"
                )

        # 5. Cash Flow - Expense Amount (Supplier Payment/Prepaid)
        if movement.expense_amount > 0:
            CashTransaction.objects.create(
                tenant=tenant, tx_type=CashTxType.OUT, currency_code=movement.currency.code,
                foreign_amount=movement.expense_amount, base_amount=movement.expense_amount, exchange_rate=1, 
                reference_type='market_tx', reference_id=movement.id,
                description=f"دفع للمزارع {supplier.name} - سطر #{movement.daily_seq}"
            )
            LedgerEntry.objects.create(
                tenant=tenant, account_type='supplier', account_id=supplier.id,
                currency_code=movement.currency.code, entry_type='DR', 
                foreign_amount=movement.expense_amount, base_amount=movement.expense_amount, exchange_rate=1,
                reference_type='market_tx', reference_id=movement.id,
                description=f"دفعة للمزارع - سطر #{movement.daily_seq}"
            )
