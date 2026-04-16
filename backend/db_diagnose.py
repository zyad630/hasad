"""Quick diagnostic: unbalanced txns + orphan cash transactions."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')
import django; django.setup()

from django.db import connection
from finance.models import LedgerEntry, CashTransaction
from django.db.models import Sum, Q

print("\n=== UNBALANCED TRANSACTIONS ===")
with connection.cursor() as c:
    c.execute("""
        SELECT
            reference_type,
            reference_id,
            ROUND(SUM(CASE WHEN entry_type='DR' THEN base_amount ELSE 0 END),3) dr,
            ROUND(SUM(CASE WHEN entry_type='CR' THEN base_amount ELSE 0 END),3) cr
        FROM finance_ledgerentry
        GROUP BY reference_type, reference_id
        HAVING ABS(
            SUM(CASE WHEN entry_type='DR' THEN base_amount ELSE 0 END) -
            SUM(CASE WHEN entry_type='CR' THEN base_amount ELSE 0 END)
        ) > 0.001
        ORDER BY dr DESC
    """)
    rows = c.fetchall()
    print(f"Found: {len(rows)}")
    for r in rows:
        ref_type, ref_id, dr, cr = r
        print(f"  ref_type={ref_type}  ref_id={ref_id}  DR={dr}  CR={cr}  DIFF={round(dr-cr,3)}")

print("\n=== ORPHAN CashTransactions (no ledger entry with account_type='cash') ===")
with connection.cursor() as c:
    c.execute("""
        SELECT ct.id, ct.reference_type, ct.tx_type, ct.base_amount, ct.currency_code
        FROM finance_cashtransaction ct
        WHERE NOT EXISTS (
            SELECT 1 FROM finance_ledgerentry le
            WHERE le.reference_id = ct.id
            AND le.account_type = 'cash'
        )
        ORDER BY ct.tx_date
    """)
    rows2 = c.fetchall()
    print(f"Found: {len(rows2)}")
    for r in rows2:
        print(f"  id={str(r[0])[:8]}  ref_type={r[1]}  tx_type={r[2]}  amount={r[3]}  {r[4]}")

print("\n=== GLOBAL TRIAL BALANCE ===")
from decimal import Decimal
agg = LedgerEntry.objects.aggregate(
    total_dr=Sum('base_amount', filter=Q(entry_type='DR')),
    total_cr=Sum('base_amount', filter=Q(entry_type='CR')),
)
dr = agg['total_dr'] or Decimal('0')
cr = agg['total_cr'] or Decimal('0')
print(f"  Total DR:   {dr:.3f}")
print(f"  Total CR:   {cr:.3f}")
print(f"  Difference: {(dr-cr):.3f}")
if abs(dr-cr) <= Decimal('0.001'):
    print("  STATUS: BALANCED ✅")
else:
    print(f"  STATUS: UNBALANCED ❌  diff={dr-cr:.3f}")
