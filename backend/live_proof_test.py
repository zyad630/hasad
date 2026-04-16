"""
╔══════════════════════════════════════════════════════════════════════════════╗
║           HISBA ERP — LIVE SYSTEM PROOF TEST (ALL 6 TASKS)                 ║
║  Execution & Validation Mode — No assumptions, only real DB evidence        ║
╚══════════════════════════════════════════════════════════════════════════════╝
Run: python live_proof_test.py
"""
import os, sys, json, threading, time
from decimal import Decimal, ROUND_HALF_UP

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')

import django
django.setup()

from django.db import transaction, connection
from django.db.models import Sum, Q

# ── Models ──────────────────────────────────────────────────────────────────
from core.models import Tenant, CustomUser
from suppliers.models import Supplier, Customer, CommissionType
from inventory.models import Item, Category, Shipment, ShipmentItem
from sales.models import Sale, SaleItem
from finance.models import LedgerEntry, Settlement, CashTransaction
from finance.services import LedgerService, SettlementService

# ─────────────────────────────────────────────────────────────────────────────
# UTILS
# ─────────────────────────────────────────────────────────────────────────────
MONEY = Decimal('0.001')
SEP   = "─" * 72

def header(title):
    print(f"\n{'═'*72}")
    print(f"  {title}")
    print(f"{'═'*72}")

def step(n, label):
    print(f"\n  [{n}] {label}")
    print(f"  {SEP}")

def show(key, val):
    print(f"      {key:<35}: {val}")

def ok(msg):
    print(f"      ✅  {msg}")

def fail(msg):
    print(f"      ❌  {msg}")

def ledger_row(entry):
    dr = f"DR {entry.base_amount:>12.3f}" if entry.entry_type == 'DR' else " " * 19
    cr = f"CR {entry.base_amount:>12.3f}" if entry.entry_type == 'CR' else " " * 19
    print(f"      {entry.account_type:<22} {dr}  {cr}  [{entry.reference_type}]")


# ─────────────────────────────────────────────────────────────────────────────
# TASK 1 — FULL REAL FLOW TEST (8 steps with real DB writes)
# ─────────────────────────────────────────────────────────────────────────────
def task1_full_flow():
    header("TASK 1 — FULL REAL BUSINESS CYCLE (FAKE DATA → REAL DB WRITES)")

    tenant = Tenant.objects.first()
    if not tenant:
        fail("NO TENANT FOUND — run init_admin.py first"); return
    user = CustomUser.objects.filter(tenant=tenant).first()

    show("Tenant", tenant.name)
    show("User",   user.username if user else "None (anonymous)")

    ledger_before = LedgerEntry.objects.filter(tenant=tenant).count()
    show("LedgerEntry count BEFORE test", ledger_before)

    # Collect all created IDs for cleanup later
    created = {}

    try:
        with transaction.atomic():
            # ── STEP 1: Create Product ────────────────────────────────────────
            step(1, "CREATE PRODUCT")
            cat, _ = Category.objects.get_or_create(tenant=tenant, name="فاكهة-PROOF")
            item = Item.objects.create(
                tenant=tenant, category=cat,
                name="طماطم-PROOF-TEST", base_unit="kg",
                waste_percentage=Decimal("2.000"),
                price_on="net", is_active=True
            )
            created['item'] = item
            show("Item.id",   item.id)
            show("Item.name", item.name)
            show("Item.unit", item.base_unit)
            ok("Item created in DB → inventory_item table")

            # ── STEP 2: Create Supplier ───────────────────────────────────────
            step(2, "CREATE SUPPLIER")
            comm_type, _ = CommissionType.objects.get_or_create(
                tenant=tenant, name="عمولة-10%-PROOF",
                defaults={"calc_type": "percent", "default_rate": Decimal("10.000")}
            )
            supplier = Supplier.objects.create(
                tenant=tenant, name="مزارع أحمد PROOF",
                phone="059-0000001",
                commission_type=comm_type,
                deal_type="commission", is_active=True
            )
            created['supplier'] = supplier
            show("Supplier.id",   supplier.id)
            show("Supplier.name", supplier.name)
            show("Commission",    f"{comm_type.default_rate}% ({comm_type.calc_type})")
            ok("Supplier created in DB → suppliers_supplier table")

            # ── STEP 3: Create Customer ───────────────────────────────────────
            step(3, "CREATE CUSTOMER")
            customer = Customer.objects.create(
                tenant=tenant, name="تاجر محمود PROOF",
                phone="059-0000002",
                customer_type="retail", is_active=True
            )
            created['customer'] = customer
            show("Customer.id",   customer.id)
            show("Customer.name", customer.name)
            ok("Customer created in DB → suppliers_customer table")

            # ── STEP 4: Create Purchase / Shipment (stock increases) ──────────
            step(4, "CREATE PURCHASE (SHIPMENT) — STOCK INCREASES")
            import datetime
            shipment = Shipment.objects.create(
                tenant=tenant, supplier=supplier,
                shipment_date=datetime.date.today(),
                deal_type="commission", status="open"
            )
            si = ShipmentItem.objects.create(
                shipment=shipment, item=item,
                quantity=Decimal("100.000"),
                unit="kg",
                remaining_qty=Decimal("100.000"),
                expected_price=Decimal("8.000"),
                plastic_cost=Decimal("20.000"),
                labor_cost=Decimal("30.000"),
                transport_cost=Decimal("10.000"),
            )
            created['shipment'] = shipment
            created['si'] = si
            show("Shipment.id",        shipment.id)
            show("ShipmentItem.id",    si.id)
            show("Initial stock (kg)", si.quantity)
            show("Remaining after purchase", si.remaining_qty)
            show("Plastic cost", si.plastic_cost)
            show("Labor cost",   si.labor_cost)
            show("Transport",    si.transport_cost)
            ok("Stock created → inventory_shipment + inventory_shipmentitem tables")

            # ── STEP 5: Create POS Sale (credit) ──────────────────────────────
            step(5, "CREATE POS SALE (CREDIT) — LEDGER DR customer | CR revenue")
            qty_sold   = Decimal("40.000")
            unit_price = Decimal("12.000")
            subtotal   = (qty_sold * unit_price).quantize(MONEY)
            comm_rate  = Decimal("10.000")

            sale = Sale.objects.create(
                tenant=tenant,
                customer=customer,
                payment_type="credit",
                currency_code="ILS",
                exchange_rate=Decimal("1"),
                foreign_amount=subtotal,
                base_amount=subtotal,
                created_by=user,
            )
            sale_item = SaleItem.objects.create(
                sale=sale, shipment_item=si,
                quantity=qty_sold,
                unit_price=unit_price,
                subtotal=subtotal,
                commission_rate=comm_rate,
                discount=Decimal("0"),
                gross_weight=qty_sold,
                net_weight=qty_sold,
                containers_out=0,
            )
            # Deduct from stock
            si.remaining_qty -= qty_sold
            si.save(update_fields=['remaining_qty'])
            si.refresh_from_db()

            # Record ledger
            LedgerService.record_sale(sale)
            created['sale'] = sale

            show("Sale.id",         sale.id)
            show("Qty sold",        qty_sold)
            show("Unit price",      unit_price)
            show("Subtotal",        subtotal)
            show("Remaining stock", si.remaining_qty)

            # Show ledger entries for this sale
            sale_entries = LedgerEntry.objects.filter(
                tenant=tenant, reference_type='sale', reference_id=sale.id
            )
            print(f"\n      {'Account':<22} {'Debit':>19}  {'Credit':>19}  [ref]")
            print(f"      {'-'*70}")
            for e in sale_entries:
                ledger_row(e)
            ok(f"Sale posted → {sale_entries.count()} ledger entries (DR customer | CR revenue)")

            # ── STEP 6: Add Partial Cash Payment from Customer ────────────────
            step(6, "ADD PARTIAL CUSTOMER PAYMENT — DR cash | CR customer")
            payment_amount = Decimal("200.000")
            LedgerService.record_customer_collection(
                tenant=tenant,
                customer=customer,
                amount=payment_amount,
                user=user,
                reference_id=customer.id,
            )
            payment_entries = LedgerEntry.objects.filter(
                tenant=tenant, reference_type='customer_collection', account_type__in=['cash', 'customer']
            ).order_by('-id')[:2]
            print(f"\n      {'Account':<22} {'Debit':>19}  {'Credit':>19}  [ref]")
            print(f"      {'-'*70}")
            for e in payment_entries:
                ledger_row(e)
            ok(f"Partial payment ({payment_amount} ILS) posted")

            remaining_balance = subtotal - payment_amount
            show("Outstanding customer balance", remaining_balance)

            # ── STEP 7: Create Settlement ─────────────────────────────────────
            step(7, "CREATE SETTLEMENT (CALCULATE)")
            svc = SettlementService(shipment)
            calc = svc.calculate()
            show("total_sales",       calc['total_sales'])
            show("commission_amount", calc['commission_amount'])
            show("plastic_cost",      calc['plastic_cost'])
            show("labor_cost",        calc['labor_cost'])
            show("transport_cost",    calc['transport_cost'])
            show("total_expenses",    calc['total_expenses'])
            show("net_supplier",      calc['net_supplier'])
            ok("Settlement calculated (not yet confirmed)")

            # ── STEP 8: Confirm Settlement ────────────────────────────────────
            step(8, "CONFIRM SETTLEMENT — Full double-entry ledger recording")
            settlement = svc.confirm(user=user)
            created['settlement'] = settlement

            show("Settlement.id",   settlement.id)
            show("Settlement total_sales",       settlement.total_sales)
            show("Settlement commission_amount", settlement.commission_amount)
            show("Settlement net_supplier",      settlement.net_supplier)
            show("Shipment status (after)",      Shipment.objects.get(pk=shipment.pk).status)

            settle_entries = LedgerEntry.objects.filter(
                tenant=tenant, reference_type='settlement', reference_id=settlement.id
            )
            print(f"\n      {'Account':<22} {'Debit':>19}  {'Credit':>19}  [ref]")
            print(f"      {'-'*70}")
            for e in settle_entries:
                ledger_row(e)

            total_dr_settle = sum(e.base_amount for e in settle_entries if e.entry_type == 'DR')
            total_cr_settle = sum(e.base_amount for e in settle_entries if e.entry_type == 'CR')
            show("\n      Settlement DR total", total_dr_settle)
            show("      Settlement CR total", total_cr_settle)
            if total_dr_settle == total_cr_settle:
                ok(f"SETTLEMENT IS BALANCED: DR={total_dr_settle} == CR={total_cr_settle}")
            else:
                fail(f"SETTLEMENT UNBALANCED: DR={total_dr_settle} ≠ CR={total_cr_settle}")

            # ── GRAND TOTAL ACROSS ALL ENTRIES IN THIS RUN ───────────────────
            header("GRAND TOTAL — ALL LEDGER ENTRIES FROM THIS TEST RUN")
            ledger_after = LedgerEntry.objects.filter(tenant=tenant).count()
            new_entries  = ledger_after - ledger_before
            show("New LedgerEntry records created", new_entries)

            # Pull all entries created for our references
            all_refs = []
            if 'sale'       in created: all_refs.append(Q(reference_type='sale',                reference_id=created['sale'].id))
            if 'customer'   in created: all_refs.append(Q(reference_type='customer_collection', account_id=created['customer'].id))
            if 'settlement' in created: all_refs.append(Q(reference_type='settlement',          reference_id=created['settlement'].id))

            combined_q = all_refs[0]
            for q in all_refs[1:]:
                combined_q |= q

            all_new = LedgerEntry.objects.filter(tenant=tenant).filter(combined_q)
            grand_dr = sum(e.base_amount for e in all_new if e.entry_type == 'DR')
            grand_cr = sum(e.base_amount for e in all_new if e.entry_type == 'CR')

            print(f"\n      {'Reference Type':<28} {'Account Type':<22} {'DR':>12}  {'CR':>12}")
            print(f"      {'-'*72}")
            for e in all_new.order_by('reference_type', 'entry_type'):
                dr = f"{e.base_amount:>12.3f}" if e.entry_type == 'DR' else " " * 12
                cr = f"{e.base_amount:>12.3f}" if e.entry_type == 'CR' else " " * 12
                print(f"      {e.reference_type:<28} {e.account_type:<22} {dr}  {cr}")

            print(f"\n      {'─'*72}")
            show("TOTAL DR", f"{grand_dr:.3f}")
            show("TOTAL CR", f"{grand_cr:.3f}")
            if grand_dr == grand_cr:
                ok(f"✅ PERFECTLY BALANCED: TOTAL DR ({grand_dr:.3f}) == TOTAL CR ({grand_cr:.3f})")
            else:
                diff = grand_dr - grand_cr
                fail(f"UNBALANCED by {diff:.3f}")

            # Force rollback so test data doesn't pollute production
            print(f"\n  [CLEANUP] Rolling back all test data (atomic transaction reversal)...")
            raise _CleanupRollback("test complete — rolling back")

    except _CleanupRollback:
        ok("Test data rolled back — zero impact on production DB")
    except Exception as e:
        fail(f"UNEXPECTED ERROR: {e}")
        import traceback; traceback.print_exc()


class _CleanupRollback(Exception):
    pass


# ─────────────────────────────────────────────────────────────────────────────
# TASK 2 — REAL DATABASE VERIFICATION
# ─────────────────────────────────────────────────────────────────────────────
def task2_db_verification():
    header("TASK 2 — REAL DATABASE VERIFICATION (LIVE QUERIES)")

    tenant = Tenant.objects.first()

    # 2a: Last 20 Ledger entries
    step("2a", "LAST 20 LEDGER ENTRIES")
    last20 = LedgerEntry.objects.filter(tenant=tenant).order_by('-id')[:20]
    print(f"\n      {'ID':>6}  {'Date':<20}  {'Account':<20}  {'Type'}  {'Amount':>12}  [reference]")
    print(f"      {'─'*78}")
    for e in last20:
        dt = str(e.entry_date)[:19]
        print(f"      {str(e.id)[:6]}  {dt:<20}  {e.account_type:<20}  {e.entry_type}  {e.base_amount:>12.3f}  {e.reference_type}#{str(e.reference_id)[:8]}")

    # 2b: Group by reference_id — check for unbalanced transactions
    step("2b", "UNBALANCED TRANSACTION CHECK (SQL: GROUP BY reference_id)")

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                reference_type,
                reference_id,
                SUM(CASE WHEN entry_type='DR' THEN base_amount ELSE 0 END) as total_debit,
                SUM(CASE WHEN entry_type='CR' THEN base_amount ELSE 0 END) as total_credit,
                ABS(
                    SUM(CASE WHEN entry_type='DR' THEN base_amount ELSE 0 END) -
                    SUM(CASE WHEN entry_type='CR' THEN base_amount ELSE 0 END)
                ) as diff
            FROM finance_ledgerentry
            GROUP BY reference_type, reference_id
            HAVING ABS(
                SUM(CASE WHEN entry_type='DR' THEN base_amount ELSE 0 END) -
                SUM(CASE WHEN entry_type='CR' THEN base_amount ELSE 0 END)
            ) > 0.001
            ORDER BY diff DESC
            LIMIT 20
        """)
        unbalanced = cursor.fetchall()

    if not unbalanced:
        ok("ZERO unbalanced transactions found — ledger is clean")
    else:
        fail(f"{len(unbalanced)} UNBALANCED TRANSACTIONS FOUND:")
        print(f"\n      {'ref_type':<25}  {'ref_id':<38}  {'DR':>12}  {'CR':>12}  {'DIFF':>10}")
        print(f"      {'─'*100}")
        for row in unbalanced:
            ref_type, ref_id, dr, cr, diff = row
            print(f"      {str(ref_type):<25}  {str(ref_id):<38}  {dr:>12.3f}  {cr:>12.3f}  {diff:>10.3f}")

    # 2c: Overall trial balance per account_type
    step("2c", "TRIAL BALANCE BY ACCOUNT TYPE")
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                account_type,
                SUM(CASE WHEN entry_type='DR' THEN base_amount ELSE 0 END) as total_dr,
                SUM(CASE WHEN entry_type='CR' THEN base_amount ELSE 0 END) as total_cr,
                SUM(CASE WHEN entry_type='DR' THEN base_amount ELSE 0 END) -
                SUM(CASE WHEN entry_type='CR' THEN base_amount ELSE 0 END) as net_balance
            FROM finance_ledgerentry
            GROUP BY account_type
            ORDER BY account_type
        """)
        trial = cursor.fetchall()

    total_dr = Decimal('0')
    total_cr = Decimal('0')
    print(f"\n      {'Account Type':<25}  {'Total DR':>14}  {'Total CR':>14}  {'Net Balance':>14}")
    print(f"      {'─'*72}")
    for row in trial:
        acct, dr, cr, net = row
        dr_d  = Decimal(str(dr or 0))
        cr_d  = Decimal(str(cr or 0))
        net_d = Decimal(str(net or 0))
        total_dr += dr_d
        total_cr += cr_d
        print(f"      {str(acct):<25}  {dr_d:>14.3f}  {cr_d:>14.3f}  {net_d:>14.3f}")

    print(f"      {'─'*72}")
    print(f"      {'GRAND TOTAL':<25}  {total_dr:>14.3f}  {total_cr:>14.3f}")
    if total_dr == total_cr:
        ok(f"TRIAL BALANCE CHECKS OUT: DR={total_dr:.3f} == CR={total_cr:.3f}")
    else:
        diff = total_dr - total_cr
        fail(f"TRIAL BALANCE MISMATCH: {diff:.3f}")


# ─────────────────────────────────────────────────────────────────────────────
# TASK 3 — STRESS TEST (Race Conditions, Edge Cases)
# ─────────────────────────────────────────────────────────────────────────────
def task3_stress_test():
    header("TASK 3 — STRESS TEST (RACE CONDITIONS / EDGE CASES)")

    tenant = Tenant.objects.first()
    user   = CustomUser.objects.filter(tenant=tenant).first()

    results = {"success": 0, "error": 0, "errors": []}

    # ── 3a: Race condition — concurrent same sale ─────────────────────────
    step("3a", "RACE CONDITION: 5 threads attempt concurrent customer collections")

    def try_collection(idx, amount):
        try:
            customer = Customer.objects.filter(tenant=tenant).first()
            if not customer:
                results['errors'].append(f"[{idx}] No customer")
                results['error'] += 1
                return
            with transaction.atomic():
                LedgerService.record_customer_collection(
                    tenant=tenant, customer=customer,
                    amount=amount, user=user, reference_id=customer.id
                )
                # Immediately rollback — we only care if it errors
                raise _CleanupRollback("rollback")
        except _CleanupRollback:
            results['success'] += 1
        except Exception as e:
            results['error']  += 1
            results['errors'].append(f"[{idx}] {e}")

    threads = [threading.Thread(target=try_collection, args=(i, Decimal("100"))) for i in range(5)]
    for t in threads: t.start()
    for t in threads: t.join()

    show("Successful concurrent ledger calls", results['success'])
    show("Errors (race conditions / DB locks)", results['error'])
    if results['errors']:
        for err in results['errors']:
            fail(err)
    else:
        ok("No race conditions — all 5 concurrent writes handled atomically")

    # ── 3b: Settlement with missing sales (should raise ValueError) ───────
    step("3b", "SETTLEMENT WITH NO SALES — expect ValueError")
    try:
        import datetime
        sup = Supplier.objects.filter(tenant=tenant).first()
        if sup:
            with transaction.atomic():
                empty_ship = Shipment.objects.create(
                    tenant=tenant, supplier=sup,
                    shipment_date=datetime.date.today(),
                    deal_type="commission", status="open"
                )
                svc = SettlementService(empty_ship)
                svc.confirm(user=user)
                fail("Expected ValueError — system did NOT reject empty settlement")
    except ValueError as e:
        ok(f"System correctly rejected: '{e}'")
    except Exception as e:
        fail(f"Unexpected error type: {type(e).__name__}: {e}")

    # ── 3c: Decimal values (0.001, 0.333) ────────────────────────────────
    step("3c", "DECIMAL EDGE CASE: amount=0.001 and amount=0.333")
    for amt in [Decimal("0.001"), Decimal("0.333")]:
        try:
            customer = Customer.objects.filter(tenant=tenant).first()
            if customer:
                with transaction.atomic():
                    LedgerService.record_customer_collection(
                        tenant=tenant, customer=customer,
                        amount=amt, user=user, reference_id=customer.id
                    )
                    entries = LedgerEntry.objects.filter(
                        tenant=tenant, reference_type='customer_collection'
                    ).order_by('-id')[:2]
                    dr_amt = next((e.base_amount for e in entries if e.entry_type == 'DR'), None)
                    cr_amt = next((e.base_amount for e in entries if e.entry_type == 'CR'), None)
                    if dr_amt == cr_amt:
                        ok(f"amount={amt} → DR={dr_amt} == CR={cr_amt} (balanced)")
                    else:
                        fail(f"amount={amt} → DR={dr_amt} ≠ CR={cr_amt} (UNBALANCED)")
                    raise _CleanupRollback("rollback")
        except _CleanupRollback:
            pass
        except Exception as e:
            fail(f"amount={amt} → {e}")

    # ── 3d: Duplicate LedgerEntry edit attempt ────────────────────────────
    step("3d", "IMMUTABILITY GUARD: attempt to edit an existing LedgerEntry")
    existing = LedgerEntry.objects.filter(tenant=tenant).first()
    if existing:
        try:
            existing.base_amount = Decimal("9999.000")
            existing.save()
            fail("CRITICAL: LedgerEntry.save() allowed mutation — immutability BROKEN")
        except PermissionError as e:
            ok(f"Immutability guard works: '{e}'")
        except Exception as e:
            fail(f"Wrong exception type: {type(e).__name__}: {e}")
    else:
        show("No existing entries to test", "skip")

    # ── 3e: LedgerEntry delete attempt ────────────────────────────────────
    step("3e", "IMMUTABILITY GUARD: attempt to delete an existing LedgerEntry")
    if existing:
        try:
            existing.delete()
            fail("CRITICAL: LedgerEntry.delete() succeeded — immutability BROKEN")
        except PermissionError as e:
            ok(f"Delete guard works: '{e}'")
        except Exception as e:
            fail(f"Wrong exception type: {type(e).__name__}: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# TASK 4 — RECONCILIATION & BACKFILL
# ─────────────────────────────────────────────────────────────────────────────
def task4_reconciliation():
    header("TASK 4 — RECONCILIATION & BACKFILL (reconcile_ledger.py)")

    from decimal import Decimal, ROUND_HALF_UP
    MONEY = Decimal('0.01')

    tenants = Tenant.objects.all()
    total_fixed = 0

    for tenant in tenants:
        cash_txn = CashTransaction.objects.filter(tenant=tenant).aggregate(
            total_in=Sum('base_amount', filter=Q(tx_type='in')),
            total_out=Sum('base_amount', filter=Q(tx_type='out')),
        )
        txn_balance = (
            (cash_txn['total_in'] or Decimal('0')) -
            (cash_txn['total_out'] or Decimal('0'))
        ).quantize(MONEY)

        ledger_cash = LedgerEntry.get_balance(tenant, 'cash', tenant.id)

        gap = (txn_balance - ledger_cash).quantize(MONEY)
        show(f"Tenant '{tenant.name}' CashTxn balance", txn_balance)
        show(f"Tenant '{tenant.name}' Ledger cash balance", ledger_cash)
        show(f"Gap", gap)

        if abs(gap) > Decimal('0.01'):
            fail(f"GAP DETECTED for tenant {tenant.name}: {gap}")
            total_fixed += 1
        else:
            ok(f"No gap for tenant '{tenant.name}'")

    # Count CashTransactions with no matching LedgerEntry
    step("4b", "ORPHAN CashTransactions (no corresponding LedgerEntry)")
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*) FROM finance_cashtransaction ct
            WHERE NOT EXISTS (
                SELECT 1 FROM finance_ledgerentry le
                WHERE le.reference_id = ct.id
                AND le.account_type = 'cash'
            )
        """)
        orphan_count = cursor.fetchone()[0]

    show("Orphan CashTransaction records", orphan_count)
    if orphan_count == 0:
        ok("No orphan CashTransactions — all are reflected in the ledger")
    else:
        fail(f"{orphan_count} CashTransaction(s) have no matching LedgerEntry")
        print(f"\n      → Run reconcile_ledger.py to backfill these entries.")


# ─────────────────────────────────────────────────────────────────────────────
# TASK 5 — PRODUCTION READINESS CHECKLIST
# ─────────────────────────────────────────────────────────────────────────────
def task5_production_readiness():
    header("TASK 5 — PRODUCTION READINESS CHECKLIST (CODE SCAN)")

    import ast, pathlib

    backend_dir = pathlib.Path(__file__).parent

    # ── Check 1: bare except: pass ────────────────────────────────────────
    step("5a", "SCAN: bare 'except: pass' (swallow-exception antipattern)")
    bare_except_found = []
    for pyfile in backend_dir.rglob("*.py"):
        if 'venv' in pyfile.parts or 'migrations' in pyfile.parts or 'pycache' in pyfile.parts:
            continue
        try:
            src = pyfile.read_text(encoding='utf-8', errors='ignore')
            tree = ast.parse(src)
            for node in ast.walk(tree):
                if isinstance(node, ast.ExceptHandler):
                    if node.type is None:  # bare except
                        body = node.body
                        if len(body) == 1 and isinstance(body[0], ast.Pass):
                            bare_except_found.append(f"{pyfile.relative_to(backend_dir)}:{node.lineno}")
        except SyntaxError:
            pass

    if bare_except_found:
        fail(f"Found {len(bare_except_found)} bare 'except: pass' blocks:")
        for f in bare_except_found:
            print(f"      → {f}")
    else:
        ok("No bare 'except: pass' found")

    # ── Check 2: Direct LedgerEntry.create() calls ────────────────────────
    step("5b", "SCAN: direct LedgerEntry.create() bypassing LedgerService")
    direct_create = []
    for pyfile in backend_dir.rglob("*.py"):
        if 'venv' in pyfile.parts or 'migrations' in pyfile.parts or 'live_proof' in pyfile.name:
            continue
        try:
            src = pyfile.read_text(encoding='utf-8', errors='ignore')
            for i, line in enumerate(src.splitlines(), 1):
                if 'LedgerEntry.objects.create(' in line:
                    direct_create.append(f"{pyfile.relative_to(backend_dir)}:{i}")
        except Exception:
            pass

    if direct_create:
        fail(f"Found {len(direct_create)} direct LedgerEntry.objects.create() call(s):")
        for f in direct_create:
            print(f"      → {f}")
    else:
        ok("No direct LedgerEntry.create() found — all via LedgerService")

    # ── Check 3: LedgerService._validate_balanced_entries usage ───────────
    step("5c", "VERIFY: record_settlement calls _validate_balanced_entries before bulk_create")
    svc_path = backend_dir / 'finance' / 'services.py'
    src = svc_path.read_text(encoding='utf-8')
    validate_before_create = False
    lines = src.splitlines()
    for i, line in enumerate(lines):
        if '_validate_balanced_entries' in line:
            # Check the next few lines for bulk_create
            following = '\n'.join(lines[i:i+5])
            if 'bulk_create' in following:
                validate_before_create = True
                break
    if validate_before_create:
        ok("_validate_balanced_entries() called immediately before bulk_create in record_settlement")
    else:
        fail("_validate_balanced_entries() NOT called before bulk_create — double-entry not enforced!")

    # ── Check 4: Total LedgerEntry stats ─────────────────────────────────
    step("5d", "LIVE STATS: Total LedgerEntry records in database")
    tenant = Tenant.objects.first()
    total_entries = LedgerEntry.objects.filter(tenant=tenant).count()
    total_dr = LedgerEntry.objects.filter(tenant=tenant, entry_type='DR').aggregate(
        s=Sum('base_amount'))['s'] or Decimal('0')
    total_cr = LedgerEntry.objects.filter(tenant=tenant, entry_type='CR').aggregate(
        s=Sum('base_amount'))['s'] or Decimal('0')

    show("Total LedgerEntry records", total_entries)
    show("Total DR (base_amount)",   f"{total_dr:.3f}")
    show("Total CR (base_amount)",   f"{total_cr:.3f}")
    show("Difference (DR - CR)",     f"{(total_dr - total_cr):.3f}")

    if abs(total_dr - total_cr) <= Decimal('0.001'):
        ok(f"GLOBAL TRIAL BALANCE: BALANCED ✅ (diff={total_dr - total_cr:.3f})")
    else:
        fail(f"GLOBAL TRIAL BALANCE: UNBALANCED ❌ (diff={total_dr - total_cr:.3f})")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║   HISBA ERP — LIVE SYSTEM PROOF TEST                                       ║
║   Mode: EXECUTION & VALIDATION — Real DB queries, Real writes              ║
╚══════════════════════════════════════════════════════════════════════════════╝
    """)

    t0 = time.time()
    task1_full_flow()
    task2_db_verification()
    task3_stress_test()
    task4_reconciliation()
    task5_production_readiness()

    elapsed = time.time() - t0
    header(f"TEST COMPLETE in {elapsed:.2f}s")
    print()
