from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from .models import Tenant, TenantStatus
from .managers import set_current_tenant

class TenantMiddleware(MiddlewareMixin):
    """
    Middleware ensuring strict tenant isolation via thread-local storage.
    Uses try/finally to prevent tenant leakage between requests.
    """
    def process_request(self, request):
        set_current_tenant(None)
        
        host = request.get_host().split(':')[0]
        
        # Super Admin / Localhost / Render handling
        allowed_hosts = ['localhost', '127.0.0.1', 'hisba.saas', 'hasad-backend.onrender.com']
        
        # Check if current host is an onrender.com host to skip tenant check for management
        if host in allowed_hosts or host.endswith('onrender.com') or '.' not in host:
            request.tenant = None
            set_current_tenant(None)
            return None

        subdomain = host.split('.')[0]
        
        try:
            tenant = Tenant.objects.get(subdomain=subdomain)
            
            # Global status check
            if tenant.status in [TenantStatus.EXPIRED, TenantStatus.SUSPENDED]:
                return JsonResponse(
                    {"detail": "حساب المحل منتهي الصلاحية أو موقوف. يرجى مراجعة إدارة الحسبة."}, 
                    status=403
                )
            
            request.tenant = tenant
            set_current_tenant(tenant)
            
        except Tenant.DoesNotExist:
            return JsonResponse({"detail": "المحل غير مسجل في نظامنا."}, status=404)

    def process_response(self, request, response):
        # Always clear the thread-local after the request finishes
        set_current_tenant(None)
        return response

    def process_exception(self, request, exception):
        # Clear thread-local if an exception occurs
        set_current_tenant(None)
        return None
