"""
One-time reconciliation script: backfills LedgerEntry records for every
CashTransaction that has no matching LedgerEntry.

Run: python reconcile_ledger.py
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')
django.setup()

from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Sum, Q
from finance.models import LedgerEntry, CashTransaction
from core.models import Tenant

MONEY = Decimal('0.01')


def reconcile_tenant(tenant):
    txns = CashTransaction.objects.filter(tenant=tenant)
    created = 0

    with transaction.atomic():
        for txn in txns:
            # Check if a matching ledger entry already exists for this CashTransaction
            exists = LedgerEntry.objects.filter(
                tenant=tenant,
                account_type='cash',
                reference_type=txn.reference_type or 'cash_transaction',
                reference_id=txn.id,
            ).exists()

            if exists:
                continue

            # Determine entry_type from tx_type
            # 'in'  = money comes in  → DEBIT  cash account
            # 'out' = money goes out  → CREDIT cash account
            entry_type = LedgerEntry.DEBIT if txn.tx_type == 'in' else LedgerEntry.CREDIT
            amount = (txn.base_amount or Decimal('0')).quantize(MONEY, ROUND_HALF_UP)

            # Use _force_insert to bypass immutability guard (reconciliation only!)
            entry = LedgerEntry(
                tenant=tenant,
                entry_type=entry_type,
                account_type='cash',
                account_id=tenant.id,
                currency_code=getattr(txn, 'currency_code', 'ILS'),
                foreign_amount=(txn.foreign_amount or amount).quantize(MONEY, ROUND_HALF_UP),
                exchange_rate=getattr(txn, 'exchange_rate', Decimal('1')),
                base_amount=amount,
                reference_type=txn.reference_type or 'cash_transaction',
                reference_id=txn.id,
                description=f'[RECONCILE] {txn.description or txn.reference_type or "cash tx"}',
                created_by=None,
            )
            # Bypass immutability check: call super().save() directly
            super(LedgerEntry, entry).save(force_insert=True)
            created += 1

    return created


def main():
    tenants = Tenant.objects.all()
    total = 0

    for tenant in tenants:
        # Check if this tenant has a mismatch
        cash_txn = CashTransaction.objects.filter(tenant=tenant).aggregate(
            total_in=Sum('base_amount', filter=Q(tx_type='in')),
            total_out=Sum('base_amount', filter=Q(tx_type='out')),
        )
        txn_balance = (
            (cash_txn['total_in'] or Decimal('0')) -
            (cash_txn['total_out'] or Decimal('0'))
        ).quantize(MONEY)

        ledger_cash = LedgerEntry.get_balance(tenant, 'cash', tenant.id)

        if abs(txn_balance - ledger_cash) > Decimal('0.01'):
            print(f'Reconciling tenant: {tenant.name} — gap: {txn_balance - ledger_cash} ج')
            n = reconcile_tenant(tenant)
            print(f'  Created {n} ledger entries')
            total += n
        else:
            print(f'OK tenant: {tenant.name}')

    print(f'\nDone. Total new LedgerEntry records: {total}')


if __name__ == '__main__':
    main()
