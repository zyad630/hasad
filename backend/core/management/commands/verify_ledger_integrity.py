from django.core.management.base import BaseCommand
from django.db.models import Sum, Q
from decimal import Decimal
from finance.models import LedgerEntry
from suppliers.models import Supplier, Customer
from core.models import Tenant

MONEY = Decimal('0.01')

class Command(BaseCommand):
    help = 'Verify ledger integrity — every balance must match ledger sum'

    def handle(self, *args, **options):
        total_errors = 0

        for tenant in Tenant.objects.filter(status__in=['active', 'trial', 'active']):
            self.stdout.write(f'\nChecking tenant: {tenant.name}')

            # Check supplier balances
            for supplier in Supplier.objects.filter(tenant=tenant):
                ledger_balance = LedgerEntry.get_balance(
                    tenant, 'supplier', supplier.id
                )
                # Suppliers have no stored balance field now — skip cached check
                # But verify ledger entries balance (DR = CR for closed items)
                dr = LedgerEntry.objects.filter(
                    tenant=tenant, account_type='supplier',
                    account_id=supplier.id, entry_type='DR'
                ).aggregate(t=Sum('amount'))['t'] or Decimal('0')

                cr = LedgerEntry.objects.filter(
                    tenant=tenant, account_type='supplier',
                    account_id=supplier.id, entry_type='CR'
                ).aggregate(t=Sum('amount'))['t'] or Decimal('0')

                if (dr - cr).quantize(MONEY) != ledger_balance.quantize(MONEY):
                    self.stdout.write(
                        self.style.ERROR(
                            f'  [CRITICAL] Supplier {supplier.name}: '
                            f'DR-CR={dr-cr} != get_balance={ledger_balance}'
                        )
                    )
                    total_errors += 1

            # Check cash balance vs CashTransaction
            from finance.models import CashTransaction
            cash_txn = CashTransaction.objects.filter(tenant=tenant).aggregate(
                total_in=Sum('amount', filter=Q(tx_type='in')),
                total_out=Sum('amount', filter=Q(tx_type='out')),
            )
            txn_balance = (
                (cash_txn['total_in'] or Decimal('0')) -
                (cash_txn['total_out'] or Decimal('0'))
            ).quantize(MONEY)

            ledger_cash = LedgerEntry.get_balance(tenant, 'cash', tenant.id)

            if abs(txn_balance - ledger_cash) > Decimal('0.01'):
                self.stdout.write(
                    self.style.ERROR(
                        f'  [CRITICAL] Cash balance mismatch: '
                        f'CashTransaction={txn_balance} vs Ledger={ledger_cash}'
                    )
                )
                total_errors += 1

        if total_errors == 0:
            self.stdout.write(self.style.SUCCESS('\nALL CHECKS PASSED — Zero discrepancies'))
        else:
            self.stdout.write(
                self.style.ERROR(f'\nFAILED — {total_errors} discrepancies found')
            )
            raise SystemExit(1)
