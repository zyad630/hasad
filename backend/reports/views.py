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
        date_from = request.query_params.get('from')
        date_to   = request.query_params.get('to')

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

        customers_qs = Customer.objects.filter(tenant=request.tenant, is_active=True).values(
            'id', 'name', 'phone', 'credit_limit', 'customer_type'
        )
        customers = list(customers_qs)

        currencies = list(Currency.objects.filter(tenant=request.tenant).values('code', 'symbol', 'name'))

        results = []
        for c in customers:
            for cur in currencies:
                bal = LedgerEntry.get_balance(
                    tenant=request.tenant,
                    account_type='customer',
                    account_id=c['id'],
                    currency_code=cur['code'],
                )
                if float(bal) > 0:
                    results.append({
                        'customer_id': str(c['id']),
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

class UnifiedStatementView(APIView):
    """
    Returns a unified dual-currency statement of account for a customer or supplier.
    Outputs chronological ledger entries with foreign_amount, base_amount, and exchange_rate.
    Supports date range filtering with opening balance.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.tenant is None:
            return Response({'detail': 'Tenant غير محدد. لا يمكن إنشاء كشف حساب بدون Tenant.'}, status=400)
        target_type = request.query_params.get('type')  # 'customer' or 'supplier'
        target_id = request.query_params.get('id')
        date_from = request.query_params.get('from')
        date_to   = request.query_params.get('to')

        if not target_type or not target_id:
            return Response({'error': 'type and id are required'}, status=400)

        from finance.models import LedgerEntry
        from django.db.models import Sum

        # 1. Calculate Opening Balance before date_from
        opening_balance_base = Decimal('0.000')
        if date_from:
            pre_entries = LedgerEntry.objects.filter(
                tenant=request.tenant,
                account_type=target_type,
                account_id=target_id,
                entry_date__date__lt=date_from
            )
            pre_dr = pre_entries.filter(entry_type='DR').aggregate(s=Sum('base_amount'))['s'] or Decimal('0')
            pre_cr = pre_entries.filter(entry_type='CR').aggregate(s=Sum('base_amount'))['s'] or Decimal('0')
            
            if target_type == 'customer':
                opening_balance_base = pre_dr - pre_cr
            else:
                opening_balance_base = pre_cr - pre_dr

        # 2. Get entries within range (or all if no range)
        qs = LedgerEntry.objects.filter(
            tenant=request.tenant,
            account_type=target_type,
            account_id=target_id
        )
        if date_from:
            qs = qs.filter(entry_date__date__gte=date_from)
        if date_to:
            qs = qs.filter(entry_date__date__lte=date_to)
        
        entries = qs.order_by('entry_date', 'id')

        statement = []
        running_base = opening_balance_base

        for e in entries:
            dr = e.base_amount if e.entry_type == 'DR' else Decimal('0')
            cr = e.base_amount if e.entry_type == 'CR' else Decimal('0')
            
            if target_type == 'customer':
                running_base += (dr - cr)
            else:
                running_base += (cr - dr)

            statement.append({
                'id': str(e.id),
                'date': e.entry_date.strftime('%Y-%m-%d %H:%M'),
                'description': e.description,
                'reference_type': e.reference_type,
                'reference_id': str(e.reference_id),
                'currency_code': e.currency_code,
                'exchange_rate': str(e.exchange_rate),
                'foreign_amount': str(e.foreign_amount),
                'base_amount': str(e.base_amount),
                'entry_type': e.entry_type,
                'running_balance_base': str(running_base.quantize(Decimal('0.001'))),
            })

        return Response({
            'target_type': target_type,
            'target_id': target_id,
            'opening_balance': str(opening_balance_base),
            'statement': statement,
            'total_balance_base': str(running_base.quantize(Decimal('0.001'))),
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
            qs = qs.filter(sale_date__date__gte=date_from)
        if date_to:
            qs = qs.filter(sale_date__date__lte=date_to)
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
