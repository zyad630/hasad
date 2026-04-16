from decimal import Decimal
from datetime import date, datetime, timedelta
from django.db.models import Sum, Count, Q, F
from django.db.models.functions import TruncDate
from django.core.cache import cache
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from sales.models import Sale
from suppliers.models import Customer, Supplier
from inventory.models import Shipment


def _cache_get(key):
    try:
        return cache.get(key)
    except Exception:
        return None


def _cache_set(key, value, timeout):
    try:
        cache.set(key, value, timeout=timeout)
    except Exception:
        pass


# ─── Preserved original views (URLs depend on these) ──────────────────────────

class DashboardView(APIView):
    """Real-time daily dashboard KPIs — Request 7."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = request.tenant
        if tenant is None:
            return Response({'detail': 'Tenant غير محدد. تأكد من تسجيل الدخول بمستخدم مرتبط بـ Tenant أو استخدم subdomain صحيح.'}, status=400)
        today = date.today()

        from core.models import Currency
        from finance.models import LedgerEntry

        # ── Today's Sales ─────────────────────────────────────────────────────
        today_sales = Sale.objects.filter(
            tenant=tenant,
            is_cancelled=False,
            sale_date__date=today,
        ).aggregate(
            total=Sum('base_amount'),  # always in ILS base currency
            count=Count('id')
        )
        sales_today = float(today_sales['total'] or 0)
        sales_today_count = today_sales['count'] or 0

        # ── All Time Sales by currency ─────────────────────────────────────────
        sales_data = list(
            Sale.objects.filter(tenant=tenant, is_cancelled=False)
            .values('currency_code')
            .annotate(total=Sum('foreign_amount'), total_base=Sum('base_amount'), count=Count('id'))
        )
        for item in sales_data:
            cur = Currency.objects.filter(tenant=tenant, code=item['currency_code']).first()
            item['currency_symbol'] = cur.symbol if cur else item['currency_code']
            item['currency_name'] = cur.name if cur else item['currency_code']

        # ── Open Shipments (Purchases Today estimation) ──────────────────────
        open_shipments = Shipment.objects.filter(tenant=tenant, status='open').count()
        today_shipments = Shipment.objects.filter(
            tenant=tenant, shipment_date=today
        ).count()

        # ── Receivables (total customer DR balances) ──────────────────────────
        from finance.models import LedgerEntry
        active_currencies = Currency.objects.filter(tenant=tenant)
        receivables = []
        total_receivables = 0.0

        for cur in active_currencies:
            dr_total = LedgerEntry.objects.filter(
                tenant=tenant, account_type='customer', currency_code=cur.code, entry_type='DR'
            ).aggregate(t=Sum('foreign_amount'))['t'] or Decimal('0')
            cr_total = LedgerEntry.objects.filter(
                tenant=tenant, account_type='customer', currency_code=cur.code, entry_type='CR'
            ).aggregate(t=Sum('foreign_amount'))['t'] or Decimal('0')
            balance = float(dr_total - cr_total)
            if balance != 0:
                receivables.append({
                    'currency_code': cur.code,
                    'currency_symbol': cur.symbol,
                    'currency_name': cur.name,
                    'amount': round(balance, 3),
                })
                total_receivables += balance

        # ── Supplier total payable ─────────────────────────────────────────────
        total_payables = 0.0
        for cur in active_currencies:
            sup_cr = LedgerEntry.objects.filter(
                tenant=tenant, account_type='supplier', currency_code=cur.code, entry_type='CR'
            ).aggregate(t=Sum('foreign_amount'))['t'] or Decimal('0')
            sup_dr = LedgerEntry.objects.filter(
                tenant=tenant, account_type='supplier', currency_code=cur.code, entry_type='DR'
            ).aggregate(t=Sum('foreign_amount'))['t'] or Decimal('0')
            total_payables += float(sup_cr - sup_dr)

        # ── Recent 5 Sales ────────────────────────────────────────────────────
        recent_sales = list(
            Sale.objects.filter(tenant=tenant, is_cancelled=False)
            .select_related('created_by')
            .order_by('-sale_date')[:5]
            .values('id', 'sale_date', 'foreign_amount', 'base_amount', 'payment_type', 'currency_code')
        )
        for s in recent_sales:
            s['foreign_amount'] = float(s['foreign_amount'])
            s['base_amount'] = float(s['base_amount'])

        # ── Recent 5 Shipments (Purchases) ────────────────────────────────────
        recent_purchases = list(
            Shipment.objects.filter(tenant=tenant)
            .select_related('supplier')
            .order_by('-created_at')[:5]
            .values('id', 'created_at', 'shipment_date', 'supplier__name', 'deal_type', 'status')
        )

        data = {
            # Today's KPIs
            'sales_today': round(sales_today, 2),
            'sales_today_count': sales_today_count,
            'open_shipments': open_shipments,
            'today_shipments': today_shipments,
            'total_receivables': round(total_receivables, 2),
            'total_payables': round(total_payables, 2),
            # Detailed breakdowns
            'sales_by_currency': sales_data,
            'receivables': receivables,
            # Quick lists
            'recent_sales': recent_sales,
            'recent_purchases': recent_purchases,
            # Counts
            'active_suppliers': Supplier.objects.filter(tenant=tenant, is_active=True).count(),
            'active_customers': Customer.objects.filter(tenant=tenant, is_active=True).count(),
            'today_date': str(today),
        }

        return Response(data)



class SalesReportView(APIView):
    """
    M-04: Daily aggregated sales — single query + 15-min cache.
    GET /api/reports/sales/?from=YYYY-MM-DD&to=YYYY-MM-DD
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.tenant is None:
            return Response({'detail': 'Tenant غير محدد. لا يمكن إنشاء تقرير المبيعات بدون Tenant.'}, status=400)
        date_from = request.query_params.get('from') or request.query_params.get('from_date')
        date_to   = request.query_params.get('to') or request.query_params.get('to_date')

        if not date_from or not date_to:
            return Response({'error': 'from و to مطلوبان (YYYY-MM-DD)'}, status=400)

        cache_key = f'report_sales_{request.tenant.id}_{date_from}_{date_to}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        data = list(
            Sale.objects.filter(
                tenant=request.tenant,
                is_cancelled=False,
                sale_date__date__range=[date_from, date_to],
            ).annotate(
                day=TruncDate('sale_date')
            ).values('day').annotate(
                total=Sum('base_amount'),
                cash=Sum('base_amount', filter=Q(payment_type='cash')),
                credit=Sum('base_amount', filter=Q(payment_type='credit')),
                count=Count('id'),
            ).order_by('day')
        )

        for row in data:
            row['total']  = str(row['total']  or '0.00')
            row['cash']   = str(row['cash']   or '0.00')
            row['credit'] = str(row['credit'] or '0.00')
            row['day']    = str(row['day'])

        _cache_set(cache_key, data, timeout=900)
        return Response(data)


class AgingReportView(APIView):
    """
    M-04: Customer receivables sorted by balance — single query + 5-min cache.
    GET /api/reports/aging/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.tenant is None:
            return Response({'detail': 'Tenant غير محدد. لا يمكن إنشاء تقرير الأعمار بدون Tenant.'}, status=400)
        cache_key = f'report_aging_{request.tenant.id}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        from finance.models import LedgerEntry
        from core.models import Currency
        from django.db.models import Sum, Case, When, DecimalField, Value
        from decimal import Decimal

        customers_qs = Customer.objects.filter(tenant=request.tenant, is_active=True).values(
            'id', 'name', 'phone', 'credit_limit', 'customer_type'
        )
        customers_map = {str(c['id']): c for c in customers_qs}

        currencies = {c['code']: c for c in Currency.objects.filter(tenant=request.tenant).values('code', 'symbol', 'name')}

        ledger_bals = LedgerEntry.objects.filter(
            tenant=request.tenant,
            account_type='customer'
        ).values('account_id', 'currency_code').annotate(
            dr=Sum(Case(When(entry_type='DR', then='foreign_amount'), default=Value(0), output_field=DecimalField())),
            cr=Sum(Case(When(entry_type='CR', then='foreign_amount'), default=Value(0), output_field=DecimalField()))
        )

        results = []
        for lb in ledger_bals:
            acct_id = str(lb['account_id'])
            if acct_id not in customers_map:
                continue
            
            # For customers, positive balance is DR - CR (They owe us)
            dr_amt = lb['dr'] or Decimal('0')
            cr_amt = lb['cr'] or Decimal('0')
            bal = dr_amt - cr_amt
            
            if bal > 0:
                c = customers_map[acct_id]
                cur = currencies.get(lb['currency_code'])
                if not cur:
                    continue
                    
                results.append({
                    'customer_id': acct_id,
                    'name': c['name'],
                    'phone': c.get('phone'),
                    'customer_type': c.get('customer_type'),
                    'credit_limit': str(c.get('credit_limit') or '0.00'),
                    'currency_code': cur['code'],
                    'currency_symbol': cur['symbol'],
                    'currency_name': cur['name'],
                    'credit_balance': str(bal),
                })

        results.sort(key=lambda x: float(x['credit_balance']), reverse=True)
        _cache_set(cache_key, results, timeout=300)
        return Response(results)


class SupplierSettlementSummaryView(APIView):
    """Per-supplier settlement summary — one query."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.tenant is None:
            return Response({'detail': 'Tenant غير محدد. لا يمكن إنشاء تقرير التسويات بدون Tenant.'}, status=400)
        from finance.models import Settlement

        cache_key = f'supplier_settlements_{request.tenant.id}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        data = list(
            Settlement.objects.filter(tenant=request.tenant)
            .values('supplier__id', 'supplier__name')
            .annotate(
                total_sales=Sum('total_sales'),
                total_commission=Sum('commission_amount'),
                total_net=Sum('net_supplier'),
                count=Count('id'),
            ).order_by('-total_net')
        )

        for row in data:
            row['supplier_id']      = str(row.pop('supplier__id'))
            row['supplier_name']    = row.pop('supplier__name')
            row['total_sales']      = str(row['total_sales']      or '0.00')
            row['total_commission'] = str(row['total_commission'] or '0.00')
            row['total_net']        = str(row['total_net']        or '0.00')

        cache.set(cache_key, data, timeout=900)
        return Response(data)

class SearchPartiesView(APIView):
    """
    Unified search across all parties (Farmers, Customers, Merchants, Employees, Partners)
    GET /api/reports/search-parties/?q=xyz
    Returns list of: {id, name, type, phone, type_label}
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.tenant is None:
            return Response({'detail': 'Tenant غير محدد.'}, status=400)
            
        q = request.query_params.get('q', '').strip()
        
        from suppliers.models import Customer, Supplier
        from finance.models import Partner
        from hr.models import Employee

        results = []

        def get_variations(text):
            if not text: return []
            variants = [text]
            # Alef variations
            v2 = text.replace('ا', 'أ').replace('ا', 'إ').replace('ا', 'آ')
            if v2 != text: variants.append(v2)
            # Yaa variations
            v3 = text.replace('ي', 'ى').replace('ى', 'ي')
            if v3 != text: variants.append(v3)
            # Taa Marbuta
            v4 = text.replace('ة', 'ه').replace('ه', 'ة')
            if v4 != text: variants.append(v4)
            return list(set(variants))

        def search_model(model_class, label, type_name, q_filter=None):
            try:
                qs = model_class.objects.filter(tenant=request.tenant)
                if hasattr(model_class, 'is_active'):
                    qs = qs.filter(is_active=True)
                
                if q:
                    variants = get_variations(q)
                    query = Q()
                    for v in variants:
                        query |= Q(name__icontains=v)
                    if hasattr(model_class, 'phone'):
                        query |= Q(phone__icontains=q)
                    qs = qs.filter(query)
                
                return [
                    {
                        'id': str(obj.id),
                        'name': obj.name,
                        'phone': getattr(obj, 'phone', '') or '',
                        'type': type_name,
                        'type_label': label,
                        'commission_type': getattr(obj, 'commission_type', 'percent'),
                        'commission_rate': str(getattr(obj, 'commission_rate', '10'))
                    }
                    for obj in qs[:40]
                ]
            except Exception:
                return []

        # 1. Suppliers
        results.extend(search_model(Supplier, 'مورد / مزارع', 'supplier'))
        # 2. Customers
        results.extend(search_model(Customer, 'زبون / تاجر', 'customer'))
        # 3. Employees
        results.extend(search_model(Employee, 'موظف', 'employee'))
        # 4. Partners
        results.extend(search_model(Partner, 'شريك / مساهم', 'partner'))

        return Response({'results': results})

class UnifiedStatementView(APIView):
    """
    Unified Account Statement — pulls from LedgerEntry (central source of truth)
    PLUS: For suppliers (farmers), it pulls unsettled sales detail to show real-time movements.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.tenant is None:
            return Response({'detail': 'Tenant غير محدد.'}, status=400)
            
        target_type = request.query_params.get('party_type') or request.query_params.get('type')
        target_id   = request.query_params.get('party_id') or request.query_params.get('id')
        date_from   = request.query_params.get('from') # YYYY-MM-DD
        date_to     = request.query_params.get('to')   # YYYY-MM-DD

        if not target_type or not target_id:
            return Response({'error': 'type and id are required.'}, status=400)

        from finance.models import LedgerEntry
        from django.db.models import Sum

        results = []
        opening_balance_base = Decimal('0.000')

        # 1. Historical Ledger Entries (Official Accounting)
        ledger_qs = LedgerEntry.objects.filter(
            tenant=request.tenant,
            account_type=target_type,
            account_id=target_id
        )

        if date_from:
            pre_ledger = ledger_qs.filter(entry_date__date__lt=date_from)
            pre_dr = pre_ledger.filter(entry_type='DR').aggregate(s=Sum('base_amount'))['s'] or Decimal('0')
            pre_cr = pre_ledger.filter(entry_type='CR').aggregate(s=Sum('base_amount'))['s'] or Decimal('0')
            
            if target_type == 'customer':
                opening_balance_base = pre_dr - pre_cr
            else:
                # For suppliers, partners, employees: CR (Owe them) - DR (Paid them)
                opening_balance_base = pre_cr - pre_dr
            
            ledger_qs = ledger_qs.filter(entry_date__date__gte=date_from)

        if date_to:
            ledger_qs = ledger_qs.filter(entry_date__date__lte=date_to)

        for e in ledger_qs.order_by('entry_date', 'id'):
            dr = float(e.base_amount) if e.entry_type == 'DR' else 0.0
            cr = float(e.base_amount) if e.entry_type == 'CR' else 0.0
            results.append({
                'date':           e.entry_date,
                'reference':      f"{e.reference_type} #{str(e.reference_id)[:8]}",
                'description':    e.description,
                'dr':             dr,
                'cr':             cr,
                'is_realtime':    False
            })

        # 2. Real-time Unsettled Movements (For Farmers/Suppliers)
        # Requirement: "Show every operation even if not yet settled"
        if target_type == 'supplier':
            from sales.models import SaleItem
            # Unsettled = Shipment is still open
            unsettled_sales = SaleItem.objects.filter(
                shipment_item__shipment__supplier_id=target_id,
                shipment_item__shipment__status='open',
                sale__is_cancelled=False,
                sale__tenant=request.tenant
            ).select_related('sale', 'shipment_item__item')

            if date_from:
                unsettled_sales = unsettled_sales.filter(sale__sale_date__date__gte=date_from)
            if date_to:
                unsettled_sales = unsettled_sales.filter(sale__sale_date__date__lte=date_to)

            for si in unsettled_sales.order_by('sale__sale_date'):
                # Net credit for farmer = subtotal - commission
                comm_amt = si.subtotal * (si.commission_rate / 100)
                net_credit = si.subtotal - comm_amt
                results.append({
                    'date':           si.sale.sale_date,
                    'reference':      f"بيع محلي #{str(si.sale.id)[:8]}",
                    'description':    f"بيع {si.quantity} {si.shipment_item.item.name} (صافي بعد عمولة {si.commission_rate}%)",
                    'dr':             0,
                    'cr':             float(net_credit),
                    'is_realtime':    True 
                })

            # Also pull unsettled expenses related to open shipments (Plastics, Labor, Transport)
            from inventory.models import ShipmentItem
            unsettled_shipment_costs = ShipmentItem.objects.filter(
                shipment__supplier_id=target_id,
                shipment__status='open',
                shipment__tenant=request.tenant
            ).select_related('item', 'shipment')

            if date_from:
                unsettled_shipment_costs = unsettled_shipment_costs.filter(shipment__shipment_date__gte=date_from)
            if date_to:
                unsettled_shipment_costs = unsettled_shipment_costs.filter(shipment__shipment_date__lte=date_to)

            for cost_item in unsettled_shipment_costs.order_by('shipment__shipment_date'):
                total_cost = float((cost_item.plastic_cost or Decimal('0')) + (cost_item.labor_cost or Decimal('0')) + (cost_item.transport_cost or Decimal('0')))
                if total_cost > 0:
                    results.append({
                        'date':           cost_item.shipment.shipment_date,
                        'reference':      f"مصاريف إرسالية #{str(cost_item.shipment.id)[:8]}",
                        'description':    f"مصاريف (بلاستيك/عتالة/نقل) للصنف {cost_item.item.name}",
                        'dr':             total_cost,
                        'cr':             0,
                        'is_realtime':    True 
                    })
                    
            from finance.models import Expense
            unsettled_expenses = Expense.objects.filter(
                shipment__supplier_id=target_id,
                shipment__status='open',
                tenant=request.tenant
            ).select_related('shipment', 'category')

            if date_from:
                unsettled_expenses = unsettled_expenses.filter(expense_date__gte=date_from)
            if date_to:
                unsettled_expenses = unsettled_expenses.filter(expense_date__lte=date_to)

            for exp in unsettled_expenses.order_by('expense_date'):
                if exp.base_amount > 0:
                    results.append({
                        'date':           exp.expense_date,
                        'reference':      f"مصروف عام #{str(exp.id)[:8]}",
                        'description':    f"مصروف على الإرسالية غير المصفاة: {exp.description or (exp.category.name if exp.category else 'عام')}",
                        'dr':             float(exp.base_amount),
                        'cr':             0,
                        'is_realtime':    True 
                    })

        # Sort the combined results by date
        results.sort(key=lambda x: x['date'] if isinstance(x['date'], str) else x['date'].isoformat())

        # 3. Calculate running balance
        running = float(opening_balance_base)
        statement_data = []
        for r in results:
            if target_type == 'customer':
                running += (r['dr'] - r['cr'])
            else:
                running += (r['cr'] - r['dr'])
            
            # Format date for JSON
            r_date = r['date'] if isinstance(r['date'], str) else r['date'].strftime('%Y-%m-%d %H:%M')
            
            statement_data.append({
                'date':           r_date,
                'description':    r['description'],
                'reference':      r['reference'],
                'dr':             r['dr'],
                'cr':             r['cr'],
                'is_realtime':    r['is_realtime'],
                'balance':        round(running, 3),
            })

        return Response({
            'target_type':        target_type,
            'target_id':          target_id,
            'opening_balance':    float(opening_balance_base),
            'statement':          statement_data,
            'current_balance':    round(running, 3)
        })


class ReceivablesPayablesView(APIView):
    """
    REQUIREMENT: ذمم (Receivables & Payables) categorized by party type.
    GET /api/reports/receivables/
    Query params:
      party=farmers|traders|employees|partners|all  (default: all)
      currency=ILS  (filter by currency, optional)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from finance.models import LedgerEntry
        from core.models import Currency
        from suppliers.models import Supplier, Customer, CustomerType

        tenant    = request.tenant
        if tenant is None:
            return Response({'detail': 'Tenant غير محدد. لا يمكن حساب الذمم بدون Tenant.'}, status=400)
        party     = request.query_params.get('party', 'all')
        cur_filter = request.query_params.get('currency', None)
        currencies = list(Currency.objects.filter(tenant=tenant).values('code', 'symbol', 'name'))

        result = {
            'farmers':    [],  # Suppliers (المزارعين) — we owe them
            'traders':    [],  # Customers type=trader — they owe us
            'employees':  [],  # Customers type=employee
            'partners':   [],  # Customers type=partner
            'other':      [],  # Other customer types
            'summary': {}
        }

        def get_ledger_balances(account_type, account_id, is_payable=False):
            """Returns list of {currency, balance} for a party."""
            balances = []
            for cur in currencies:
                code = cur['code']
                if cur_filter and code != cur_filter:
                    continue
                bal = LedgerEntry.get_balance(
                    tenant=tenant,
                    account_type=account_type,
                    account_id=account_id,
                    currency_code=code,
                )
                # Suppliers: CR-DR = what we owe them (payable)
                # Customers: DR-CR = what they owe us (receivable)
                if is_payable:
                    # For suppliers, get_balance returns DR-CR, but we want CR-DR (what we owe)
                    bal = -bal
                if bal != 0:
                    balances.append({
                        'currency_code':   code,
                        'currency_symbol': cur['symbol'],
                        'currency_name':   cur['name'],
                        'balance':         str(bal),
                    })
            return balances

        # ─── FARMERS (Suppliers) — Payables ─────────────────────────────────
        if party in ('all', 'farmers'):
            suppliers = Supplier.objects.filter(tenant=tenant, is_active=True).values('id', 'name', 'phone', 'whatsapp_number', 'deal_type')
            for s in suppliers:
                bals = get_ledger_balances('supplier', s['id'], is_payable=True)
                if bals:
                    result['farmers'].append({
                        'id':     str(s['id']),
                        'name':   s['name'],
                        'phone':  s['phone'],
                        'whatsapp': s.get('whatsapp_number'),
                        'deal_type': s['deal_type'],
                        'party_type': 'supplier',
                        'direction': 'payable',  # We owe them
                        'balances': bals,
                    })

        # ─── CUSTOMERS by type — Receivables ────────────────────────────────
        customer_type_map = {
            'traders':   ['trader', 'retail', 'individual'],
            'employees': ['employee'],
            'partners':  ['partner'],
        }

        for group_key, ctypes in customer_type_map.items():
            if party not in ('all', group_key):
                continue
            customers_qs = Customer.objects.filter(
                tenant=tenant, is_active=True, customer_type__in=ctypes
            ).values('id', 'name', 'phone', 'whatsapp_number', 'customer_type', 'credit_limit')
            for c in customers_qs:
                bals = get_ledger_balances('customer', c['id'], is_payable=False)
                if bals:
                    result[group_key].append({
                        'id':           str(c['id']),
                        'name':         c['name'],
                        'phone':        c['phone'],
                        'whatsapp':     c.get('whatsapp_number'),
                        'customer_type': c['customer_type'],
                        'party_type':   'customer',
                        'direction':    'receivable',  # They owe us
                        'credit_limit': str(c.get('credit_limit') or '0'),
                        'balances':     bals,
                    })

        # ─── Summary totals (base ILS) ───────────────────────────────────────
        def sum_base(entries):
            total = Decimal('0')
            for e in entries:
                b = LedgerEntry.get_balance(
                    tenant=tenant,
                    account_type='supplier' if e.get('party_type') == 'supplier' else 'customer',
                    account_id=e['id'],
                    unified_base=True
                )
                if e.get('direction') == 'payable':
                    total -= b
                else:
                    total += b
            return float(total)

        result['summary'] = {
            'total_receivable_base': round(sum([
                float(b['balance']) for e in result['traders'] + result['employees'] + result['partners']
                for b in e['balances'] if b['currency_code'] == (cur_filter or 'ILS')
            ]), 3),
            'total_payable_base': round(sum([
                float(b['balance']) for e in result['farmers']
                for b in e['balances'] if b['currency_code'] == (cur_filter or 'ILS')
            ]), 3),
            'farmers_count':   len(result['farmers']),
            'traders_count':   len(result['traders']),
            'employees_count': len(result['employees']),
            'partners_count':  len(result['partners']),
        }

        return Response(result)


class SalesInvoicesListView(APIView):
    """
    Full invoices list with filters: date range, customer, status, currency.
    Supports reporting after posting.
    GET /api/reports/invoices/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.tenant is None:
            return Response({'detail': 'Tenant غير محدد. لا يمكن عرض قائمة الفواتير بدون Tenant.'}, status=400)
        from sales.models import Sale
        from sales.serializers import SaleSerializer

        qs = Sale.objects.filter(tenant=request.tenant).select_related(
            'customer', 'created_by'
        ).prefetch_related('items__shipment_item__item').order_by('-sale_date')

        date_from = request.query_params.get('from')
        date_to   = request.query_params.get('to')
        customer  = request.query_params.get('customer')
        cancelled = request.query_params.get('cancelled')  # 'true'/'false'/'all'
        currency  = request.query_params.get('currency')

        if date_from:
            qs = qs.filter(sale_date__gte=f"{date_from} 00:00:00")
        if date_to:
            qs = qs.filter(sale_date__lte=f"{date_to} 23:59:59")
        if customer:
            qs = qs.filter(customer_id=customer)
        if cancelled == 'true':
            qs = qs.filter(is_cancelled=True)
        elif cancelled == 'false':
            qs = qs.filter(is_cancelled=False)
        if currency:
            qs = qs.filter(currency_code=currency)

        data = SaleSerializer(qs[:200], many=True).data
        return Response({'results': data, 'count': qs.count()})
