from decimal import Decimal
from django.db.models import Sum, Count, Q, Max, ExpressionWrapper, DurationField
from django.db.models.functions import TruncDate, Now
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from sales.models import Sale
from suppliers.models import Customer, Supplier
from inventory.models import Shipment


# ─── Preserved original views (URLs depend on these) ──────────────────────────

class DashboardView(APIView):
    """Multi-currency dashboard KPIs."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = request.user.tenant
        
        # Sales by currency with details
        from core.models import Currency
        sales_data = list(
            Sale.objects.filter(tenant=tenant, is_cancelled=False)
            .values('currency_code')
            .annotate(
                total=Sum('total_amount'),
                count=Count('id')
            )
        )
        
        for item in sales_data:
            cur = Currency.objects.filter(tenant=tenant, code=item['currency_code']).first()
            item['currency_symbol'] = cur.symbol if cur else item['currency_code']
            item['currency_name'] = cur.name if cur else item['currency_code']

        # Pending items
        open_shipments = Shipment.objects.filter(tenant=tenant, status='open').count()
        
        # Receivables (summary from LedgerEntry)
        from finance.models import LedgerEntry
        
        active_currencies = Currency.objects.filter(tenant=tenant)
        receivables = []
        
        for cur in active_currencies:
            balance = LedgerEntry.objects.filter(
                tenant=tenant,
                account_type='customer',
                currency_code=cur.code
            ).aggregate(bal=Sum('amount'))['bal'] or Decimal('0')
            
            if balance != 0:
                receivables.append({
                    'currency_code': cur.code,
                    'currency_symbol': cur.symbol,
                    'currency_name': cur.name,
                    'amount': str(balance)
                })

        data = {
            'sales_by_currency': sales_data,
            'open_shipments': open_shipments,
            'receivables': receivables,
            'active_suppliers': Supplier.objects.filter(tenant=tenant, is_active=True).count(),
        }

        return Response(data)


class SalesReportView(APIView):
    """
    M-04: Daily aggregated sales — single query + 15-min cache.
    GET /api/reports/sales/?from=YYYY-MM-DD&to=YYYY-MM-DD
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from = request.query_params.get('from')
        date_to   = request.query_params.get('to')

        if not date_from or not date_to:
            return Response({'error': 'from و to مطلوبان (YYYY-MM-DD)'}, status=400)

        cache_key = f'report_sales_{request.user.tenant.id}_{date_from}_{date_to}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        data = list(
            Sale.objects.filter(
                tenant=request.user.tenant,
                is_cancelled=False,
                sale_date__date__range=[date_from, date_to],
            ).annotate(
                day=TruncDate('sale_date')
            ).values('day').annotate(
                total=Sum('total_amount'),
                cash=Sum('total_amount', filter=Q(payment_type='cash')),
                credit=Sum('total_amount', filter=Q(payment_type='credit')),
                count=Count('id'),
            ).order_by('day')
        )

        for row in data:
            row['total']  = str(row['total']  or '0.00')
            row['cash']   = str(row['cash']   or '0.00')
            row['credit'] = str(row['credit'] or '0.00')
            row['day']    = str(row['day'])

        cache.set(cache_key, data, timeout=900)
        return Response(data)


class AgingReportView(APIView):
    """
    M-04: Customer receivables sorted by balance — single query + 5-min cache.
    GET /api/reports/aging/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = f'report_aging_{request.user.tenant.id}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        customers = list(
            Customer.objects.filter(
                tenant=request.user.tenant,
                credit_balance__gt=0,
                is_active=True,
            ).values(
                'id', 'name', 'phone', 'credit_balance', 'credit_limit', 'customer_type'
            ).order_by('-credit_balance')
        )

        for c in customers:
            c['id']             = str(c['id'])
            c['credit_balance'] = str(c['credit_balance'])
            c['credit_limit']   = str(c['credit_limit'])

        cache.set(cache_key, customers, timeout=300)
        return Response(customers)


class SupplierSettlementSummaryView(APIView):
    """Per-supplier settlement summary — one query."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from finance.models import Settlement

        cache_key = f'supplier_settlements_{request.user.tenant.id}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        data = list(
            Settlement.objects.filter(tenant=request.user.tenant)
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
