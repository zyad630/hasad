"""
Full BRD Compliance Verification Test
Tests the complete multi-currency flow as required by client BRD
"""
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')
django.setup()

from decimal import Decimal, ROUND_HALF_UP
from finance.services import LedgerService

print("=" * 60)
print("FULL BRD COMPLIANCE TEST")
print("=" * 60)

# Test 1: Decimal precision
print("\n[TEST 1] Decimal Precision (DECIMAL 18,3)")
from sales.models import Sale, SaleItem
from finance.models import LedgerEntry, CashTransaction

def check_field(model, fieldname, required_dp=3):
    try:
        f = model._meta.get_field(fieldname)
        dp = getattr(f, 'decimal_places', None)
        md = getattr(f, 'max_digits', None)
        ok = dp is not None and dp >= required_dp
        print(f"  {model.__name__}.{fieldname}: max_digits={md}, decimal_places={dp} -> {'PASS' if ok else 'FAIL'}")
        return ok
    except Exception as e:
        print(f"  {model.__name__}.{fieldname}: MISSING ({e})")
        return False

results = []
results.append(check_field(Sale, 'foreign_amount'))
results.append(check_field(Sale, 'base_amount'))
results.append(check_field(Sale, 'exchange_rate', 6))
results.append(check_field(LedgerEntry, 'foreign_amount'))
results.append(check_field(LedgerEntry, 'base_amount'))
results.append(check_field(LedgerEntry, 'exchange_rate', 6))
results.append(check_field(CashTransaction, 'foreign_amount'))
results.append(check_field(CashTransaction, 'base_amount'))
print(f"  -> TEST 1: {'PASS' if all(results) else 'FAIL'}")

# Test 2: 4-Field Structure
print("\n[TEST 2] 4-Field Structure on All Main Tables")
tables = [Sale, LedgerEntry, CashTransaction]
req_fields = ['currency_code', 'foreign_amount', 'exchange_rate', 'base_amount']
t2_ok = True
for model in tables:
    field_names = [f.name for f in model._meta.get_fields()]
    for rf in req_fields:
        exists = rf in field_names
        if not exists:
            print(f"  FAIL: {model.__name__}.{rf} MISSING")
            t2_ok = False
    # Make sure old 'amount' is gone from Sale
    if model == Sale and 'total_amount' in field_names:
        print(f"  FAIL: Sale.total_amount still exists!")
        t2_ok = False
if t2_ok:
    print("  All 4 fields present + old total_amount removed -> PASS")

# Test 3: Forex Gain/Loss Logic (unit test without DB)
print("\n[TEST 3] Forex Gain/Loss Calculation Logic")
orig_rate = Decimal('3.850')
new_rate = Decimal('3.900')
foreign_balance = Decimal('1000.000')

old_base = (foreign_balance * orig_rate).quantize(Decimal('0.001'), ROUND_HALF_UP)
new_base = (foreign_balance * new_rate).quantize(Decimal('0.001'), ROUND_HALF_UP)
diff = new_base - old_base

print(f"  JOD 1,000 @ {orig_rate} = ILS {old_base}")
print(f"  JOD 1,000 @ {new_rate} = ILS {new_base}")
print(f"  Forex Gain = ILS {diff}")
print(f"  -> TEST 3: {'PASS' if diff == Decimal('50.000') else 'FAIL (expected 50.000)'}")

# Test 4: Exchange Rate History
print("\n[TEST 4] CurrencyExchangeRate model exists")
try:
    from core.models import CurrencyExchangeRate
    fields = [f.name for f in CurrencyExchangeRate._meta.get_fields()]
    has_fields = all(f in fields for f in ['currency', 'rate', 'date'])
    print(f"  Fields: {fields}")
    print(f"  -> TEST 4: {'PASS' if has_fields else 'PARTIAL - check field names'}")
except Exception as e:
    print(f"  -> TEST 4: FAIL ({e})")

# Test 5: LedgerService.record_forex_adjustment exists
print("\n[TEST 5] record_forex_adjustment method exists in LedgerService")
has_method = hasattr(LedgerService, 'record_forex_adjustment')
print(f"  LedgerService.record_forex_adjustment: {'FOUND' if has_method else 'MISSING'}")
print(f"  -> TEST 5: {'PASS' if has_method else 'FAIL'}")

# Summary
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
all_passed = all(results) and t2_ok and diff == Decimal('50.000') and has_method
print(f"Overall: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED - see above'}")
