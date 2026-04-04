import sys
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db.models import Sum, F
from django.utils import timezone

from core.models import Tenant
from suppliers.models import Supplier, Customer
from inventory.models import ShipmentItem, Shipment
from finance.models import CashTransaction, Settlement, Expense
from sales.models import Sale, SaleItem

class Command(BaseCommand):
    help = 'Verify total financial integrity of the system data'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Starting Deep Financial Integrity Audit..."))
        
        tenants = Tenant.objects.all()
        
        total_records_checked = 0
        total_discrepancies = 0
        discrepancies_details = []

        for tenant in tenants:
            self.stdout.write(f"\n--- Auditing Tenant: {tenant.name} ---")

            # Check 1: ShipmentItem remaining_qty == quantity - SUM(SaleItem.quantity)
            ship_items = ShipmentItem.objects.filter(shipment__tenant=tenant)
            for si in ship_items:
                total_records_checked += 1
                sales_qty = SaleItem.objects.filter(shipment_item=si).aggregate(t=Sum('quantity'))['t'] or Decimal('0.00')
                sales_qty = Decimal(str(sales_qty))
                expected_remaining = Decimal(str(si.quantity)) - sales_qty
                actual_remaining = Decimal(str(si.remaining_qty))
                
                if expected_remaining != actual_remaining:
                    total_discrepancies += 1
                    discrepancies_details.append(
                        f"[ShipmentItem {si.id}] Remaining Qty Mismatch. Expected: {expected_remaining}, Actual: {actual_remaining}, Diff: {actual_remaining - expected_remaining}"
                    )

            # Check 2 & 4 & 5 (Settlements & Suppliers)
            # 5. Settlement: net_supplier == total_sales - commission_amount - total_expenses
            # and total_sales == SUM(SaleItem.subtotal for shipment)
            settlements = Settlement.objects.filter(tenant=tenant)
            for settle in settlements:
                total_records_checked += 1
                
                # Check net formula
                expected_net = Decimal(str(settle.total_sales)) - Decimal(str(settle.commission_amount)) - Decimal(str(settle.total_expenses))
                actual_net = Decimal(str(settle.net_supplier))
                if expected_net != actual_net:
                    total_discrepancies += 1
                    discrepancies_details.append(
                        f"[Settlement {settle.id}] Net Supplier Mismatch. Expected: {expected_net}, Actual: {actual_net}, Diff: {actual_net - expected_net}"
                    )
                
                # Check aggregate total_sales
                agg_sales = SaleItem.objects.filter(sale__tenant=tenant, shipment_item__shipment=settle.shipment).aggregate(t=Sum('subtotal'))['t'] or Decimal('0.00')
                agg_sales = Decimal(str(agg_sales))
                actual_sales = Decimal(str(settle.total_sales))
                if agg_sales != actual_sales:
                    total_discrepancies += 1
                    discrepancies_details.append(
                        f"[Settlement {settle.id}] Sales Sum Mismatch. Expected (Sum of SaleItems): {agg_sales}, Actual: {actual_sales}, Diff: {actual_sales - agg_sales}"
                    )

            # Check 2: Tenant CashBalance expected (we just calculate net IN-OUT)
            sum_cash_in = CashTransaction.objects.filter(tenant=tenant, tx_type='in').aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
            sum_cash_out = CashTransaction.objects.filter(tenant=tenant, tx_type='out').aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
            tenant_actual_balance = Decimal(str(sum_cash_in)) - Decimal(str(sum_cash_out))

            self.stdout.write(f"  [Info] Tenant Cash Flow: IN {sum_cash_in} | OUT {sum_cash_out} | NET {tenant_actual_balance}")

            # 4. Supplier: balance == SUM(Settlement.net_supplier) - SUM(CashTransaction supplier_payment)
            suppliers = Supplier.objects.filter(tenant=tenant)
            for supp in suppliers:
                total_records_checked += 1
                
                sum_settle_net = Settlement.objects.filter(supplier=supp).aggregate(t=Sum('net_supplier'))['t'] or Decimal('0.00')
                sum_payments = CashTransaction.objects.filter(tenant=tenant, reference_type='supplier_payment', reference_id=supp.id).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
                
                # Assume standard deal: balance = owed to supplier = settlements - payments
                expected_balance = Decimal(str(sum_settle_net)) - Decimal(str(sum_payments))
                actual_balance = Decimal(str(supp.balance))
                
                if expected_balance != actual_balance:
                    total_discrepancies += 1
                    discrepancies_details.append(
                        f"[Supplier {supp.id}] Balance Mismatch. Expected: {expected_balance}, Actual: {actual_balance}, Diff: {actual_balance - expected_balance}"
                    )

            # Check 3: Customer: credit_balance == SUM(credit sales) - SUM(customer_payment)
            customers = Customer.objects.filter(tenant=tenant)
            for cust in customers:
                total_records_checked += 1
                
                sum_credit_sales = Sale.objects.filter(customer=cust, payment_type='credit').aggregate(t=Sum('total_amount'))['t'] or Decimal('0.00')
                sum_collections = CashTransaction.objects.filter(tenant=tenant, reference_type='customer_payment', reference_id=cust.id).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
                
                expected_credit = Decimal(str(sum_credit_sales)) - Decimal(str(sum_collections))
                actual_credit = Decimal(str(cust.credit_balance))
                
                if expected_credit != actual_credit:
                    total_discrepancies += 1
                    discrepancies_details.append(
                        f"[Customer {cust.id}] Credit Balance Mismatch. Expected: {expected_credit}, Actual: {actual_credit}, Diff: {actual_credit - expected_credit}"
                    )

        # Output Results
        self.stdout.write("\n==================================")
        self.stdout.write(self.style.SUCCESS('FINANCIAL INTEGRITY REPORT') if total_discrepancies == 0 else self.style.ERROR('FINANCIAL INTEGRITY REPORT - CRITICAL BUGS FOUND'))
        self.stdout.write("==================================")
        self.stdout.write(f"Total Records Verified: {total_records_checked}")
        self.stdout.write(f"Total Discrepancies Found: {total_discrepancies}")
        
        if total_discrepancies > 0:
            self.stdout.write("\nDetailed Breakdown of Discrepancies (Showing first 50):")
            for i, detail in enumerate(discrepancies_details[:50]):
                self.stdout.write(self.style.ERROR(f" {i+1}. {detail}"))
            
            if total_discrepancies > 50:
                self.stdout.write(f"... and {total_discrepancies - 50} more.")
                
            sys.exit(1) # Fail the execution representing a broken integrity state
        else:
            self.stdout.write(self.style.SUCCESS("\n100% PERFECT FINANCIAL SYSTEM. NO FRACTIONS, NO LEAKS. 💎"))
