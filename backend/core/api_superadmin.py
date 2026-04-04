from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta

from core.models import Tenant, TenantDailySnapshot, AuditLog

class IsSuperAdmin(permissions.BasePermission):
    """
    Allows access only to SuperAdmin users.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'super_admin')

@api_view(['GET'])
@permission_classes([IsSuperAdmin])
def overview(request):
    today = timezone.now().date()
    yesterday = today - timedelta(days=1)
    
    active_tenants = Tenant.objects.filter(status='active').count()
    trial_tenants = Tenant.objects.filter(status='trial').count()
    
    # Yesterday's Global Sales
    yesterday_stats = TenantDailySnapshot.objects.filter(date=yesterday).aggregate(
        t_sales=Sum('sales_total'), t_comm=Sum('commissions_earned')
    )
    
    # Alerts logic (Ex: high error counts yesterday)
    alerts = TenantDailySnapshot.objects.filter(date=yesterday, error_count__gt=0).count()
    
    return Response({
        'active_tenants': active_tenants,
        'trial_tenants': trial_tenants,
        'yesterday_sales': yesterday_stats['t_sales'] or 0,
        'yesterday_commissions': yesterday_stats['t_comm'] or 0,
        'alerts_count': alerts
    })

@api_view(['GET'])
@permission_classes([IsSuperAdmin])
def list_tenants(request):
    """List tenants with recent snapshot metrics."""
    tenants = Tenant.objects.all().order_by('-created_at')
    result = []
    
    for t in tenants:
        last_snap = TenantDailySnapshot.objects.filter(tenant=t).order_by('-date').first()
        result.append({
            'id': t.id,
            'name': t.name,
            'subdomain': t.subdomain,
            'status': t.status,
            'created_at': t.created_at,
            'yesterday_sales': last_snap.sales_total if last_snap else 0,
            'active_users': last_snap.active_users if last_snap else 0,
        })
    return Response(result)

@api_view(['GET'])
@permission_classes([IsSuperAdmin])
def tenant_activity(request, tenant_id):
    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
        
    thirty_days_ago = timezone.now().date() - timedelta(days=30)
    snapshots = TenantDailySnapshot.objects.filter(
        tenant=tenant, date__gte=thirty_days_ago
    ).order_by('date').values('date', 'sales_total', 'commissions_earned', 'active_users')
    
    recent_logs = AuditLog.objects.filter(tenant=tenant).select_related('user').order_by('-created_at')[:20]
    
    logs_data = []
    for l in recent_logs:
        logs_data.append({
            'id': l.id,
            'action': l.action,
            'user': l.user.username if l.user else 'System',
            'created_at': l.created_at,
            'delta': l.delta
        })
        
    return Response({
        'tenant_details': {
            'name': tenant.name,
            'subdomain': tenant.subdomain,
        },
        'snapshots_30d': list(snapshots),
        'recent_logs': logs_data
    })

@api_view(['GET'])
@permission_classes([IsSuperAdmin])
def list_audit_logs(request):
    tenant_id = request.query_params.get('tenant')
    action = request.query_params.get('action')
    
    qs = AuditLog.objects.all().select_related('tenant', 'user').order_by('-created_at')
    
    if tenant_id:
        qs = qs.filter(tenant_id=tenant_id)
    if action:
        qs = qs.filter(action=action)
        
    # Pagination simplified here for brevity
    qs = qs[:100]
    
    data = []
    for log in qs:
        data.append({
            'id': log.id,
            'tenant_name': log.tenant.name,
            'user': log.user.username if log.user else 'System',
            'action': log.action,
            'entity_type': log.entity_type,
            'delta': log.delta,
            'timestamp': log.created_at
        })
        
    return Response(data)
