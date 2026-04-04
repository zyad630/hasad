from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from core.models import Tenant, TenantDailySnapshot, AuditLog
from sales.models import Sale
from finance.models import Settlement
from django.db.models import Sum, Count

@shared_task
def build_daily_snapshots():
    today = timezone.now().date()
    yesterday_qs = timezone.now() - timedelta(days=1)
    
    tenants = Tenant.objects.filter(status__in=['active', 'trial'])
    
    for tenant in tenants:
        # Sales stats
        today_sales = Sale.objects.filter(tenant=tenant, sale_date__date=today)
        sales_count = today_sales.count()
        sales_total = today_sales.aggregate(t=Sum('total_amount'))['t'] or 0
        cash_sales = today_sales.filter(payment_type='cash').aggregate(t=Sum('total_amount'))['t'] or 0
        credit_sales = today_sales.filter(payment_type='credit').aggregate(t=Sum('total_amount'))['t'] or 0
        
        # Settlements
        today_settlements = Settlement.objects.filter(tenant=tenant, settled_at__date=today)
        settlements_count = today_settlements.count()
        commissions_earned = today_settlements.aggregate(t=Sum('commission_amount'))['t'] or 0
        
        # Audit Logs (Activity)
        logs = AuditLog.objects.filter(tenant=tenant, created_at__date=today)
        active_users = logs.values('user_id').distinct().count()
        
        # Snap it
        TenantDailySnapshot.objects.update_or_create(
            tenant=tenant,
            date=today,
            defaults={
                'sales_count': sales_count,
                'sales_total': sales_total,
                'cash_sales': cash_sales,
                'credit_sales': credit_sales,
                'settlements_count': settlements_count,
                'commissions_earned': commissions_earned,
                'active_users': active_users,
            }
        )
