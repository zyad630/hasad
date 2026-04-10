import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')
django.setup()

from finance.models import LedgerEntry, CashTransaction
from sales.models import Sale

print('=== Sale Model 4-Field Check ===')
sale_fields = {f.name: f for f in Sale._meta.get_fields() if hasattr(f, 'decimal_places')}
for name in ['foreign_amount','base_amount','exchange_rate']:
    f = Sale._meta.get_field(name)
    print(f'  Sale.{name}: max_digits={f.max_digits}, decimal_places={f.decimal_places}')
print(f'  Sale.total_amount: {"STILL EXISTS (BUG)" if any(f.name=="total_amount" for f in Sale._meta.get_fields()) else "REMOVED OK"}')

print()
print('=== LedgerEntry 4-Field Check ===')
le_fields = [f.name for f in LedgerEntry._meta.get_fields()]
for fname in ['currency_code', 'foreign_amount', 'exchange_rate', 'base_amount']:
    exists = fname in le_fields
    print(f'  {fname}: {"FOUND" if exists else "MISSING !!"}')
print(f'  old "amount": {"STILL EXISTS (BUG)" if "amount" in le_fields else "NOT PRESENT (OK)"}')

print()
print('=== LedgerEntry Decimal Precision ===')
for field in LedgerEntry._meta.get_fields():
    if hasattr(field, 'decimal_places') and field.decimal_places is not None:
        ok = 'OK' if field.decimal_places >= 3 else f'BAD! only {field.decimal_places} decimals'
        print(f'  {field.name}: decimal_places={field.decimal_places} -> {ok}')

print()
print('=== CashTransaction 4-Field Check ===')
ct_fields = [f.name for f in CashTransaction._meta.get_fields()]
for fname in ['currency_code', 'foreign_amount', 'exchange_rate', 'base_amount']:
    print(f'  {fname}: {"FOUND" if fname in ct_fields else "MISSING !!"}')
