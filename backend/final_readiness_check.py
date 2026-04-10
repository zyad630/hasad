import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')
django.setup()

from decimal import Decimal
from finance.models import LedgerEntry, Expense, CashTransaction, Check, AdvancedCheck, AccountGroup, Account
from suppliers.models import Supplier, Customer
from sales.models import Sale

print("=" * 65)
print("FINAL BRD COMPLIANCE CHECK")
print("=" * 65)

# --- 1. 4-Field Structure + DECIMAL(18,3) ---
errors = []
for model, fname in [
    (LedgerEntry, 'foreign_amount'), (LedgerEntry, 'exchange_rate'), (LedgerEntry, 'base_amount'),
    (Expense, 'foreign_amount'), (Expense, 'exchange_rate'), (Expense, 'base_amount'),
    (CashTransaction, 'foreign_amount'), (CashTransaction, 'exchange_rate'), (CashTransaction, 'base_amount'),
    (Check, 'foreign_amount'), (Check, 'exchange_rate'), (Check, 'base_amount'),
    (AdvancedCheck, 'foreign_amount'), (AdvancedCheck, 'exchange_rate'), (AdvancedCheck, 'base_amount'),
]:
    field = model._meta.get_field(fname)
    md = getattr(field, 'max_digits', 0)
    dp = getattr(field, 'decimal_places', 0)
    ok = md == 18 and dp >= 3
    if not ok:
        errors.append(f"FAILED: {model.__name__}.{fname} max_digits={md} dp={dp}")

if errors:
    for e in errors: print(e)
else:
    print("[CHECK 1] 4-Field + DECIMAL(18,3): PASSED (all 15 field checks OK)")

# --- 2. Chart of Accounts tables ---
try:
    ag = AccountGroup.objects.count()
    ac = Account.objects.count()
    print(f"[CHECK 2] Chart of Accounts DB tables: PASSED (Groups={ag}, Accounts={ac})")
except Exception as ex:
    print(f"[CHECK 2] Chart of Accounts: FAILED - {ex}")

# --- 3. LedgerEntry.get_balance method ---
try:
    from core.models import Tenant
    t = Tenant.objects.first()
    if t:
        bal = LedgerEntry.get_balance(t, 'supplier', t.id, 'ILS')
        print(f"[CHECK 3] LedgerEntry.get_balance() method: PASSED (returned {bal})")
    else:
        print("[CHECK 3] LedgerEntry.get_balance(): SKIPPED (no tenant)")
except Exception as ex:
    print(f"[CHECK 3] LedgerEntry.get_balance(): FAILED - {ex}")

# --- 4. Forex service ---
try:
    from finance.services import LedgerService
    sig = LedgerService.record_forex_adjustment.__doc__
    print("[CHECK 4] Forex Gain/Loss service (record_forex_adjustment): PASSED")
except Exception as ex:
    print(f"[CHECK 4] Forex service: FAILED - {ex}")

# --- 5. Check migrations applied ---
try:
    from django.db import connection
    tables = connection.introspection.table_names()
    required = ['finance_check', 'finance_advancedcheck', 'finance_ledgerentry', 'finance_expense', 'finance_accountgroup', 'finance_account']
    missing = [t for t in required if t not in tables]
    if missing:
        print(f"[CHECK 5] DB Tables: FAILED - missing: {missing}")
    else:
        print("[CHECK 5] All required DB tables present: PASSED")
except Exception as ex:
    print(f"[CHECK 5] DB Tables: FAILED - {ex}")

# --- 6. Check API endpoint existence ---
try:
    from hisba_backend.urls import router
    registered = [prefix for prefix, viewset, basename in router.registry]
    required_routes = ['account-groups', 'accounts', 'ledger-entries', 'settlements', 'expenses', 'cash-transactions']
    missing_routes = [r for r in required_routes if r not in registered]
    if missing_routes:
        print(f"[CHECK 6] API Routes: PARTIAL - missing: {missing_routes}")
    else:
        print(f"[CHECK 6] All API routes registered: PASSED ({len(registered)} total routes)")
except Exception as ex:
    print(f"[CHECK 6] API Routes: FAILED - {ex}")

print("=" * 65)
print("OVERALL: System check complete.")
print("=" * 65)
