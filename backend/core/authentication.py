from rest_framework_simplejwt.authentication import JWTAuthentication
from core.managers import set_current_tenant

class TenantJWTAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication that sets request.tenant to the authenticated user's tenant
    if the middleware didn't find a subdomain (e.g. on localhost or bare domains).
    """
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, token = result
            # Try to attach the user's tenant to the request
            # if it was not already resolved via subdomain
            if not getattr(request, 'tenant', None) and user.tenant:
                request.tenant = user.tenant
                set_current_tenant(user.tenant)
            
            # Allow super_admin to act as Default tenant if they have none
            # just so they can test the UI without crashing
            elif not getattr(request, 'tenant', None) and user.role == 'super_admin':
                from core.models import Tenant
                default_tenant = Tenant.objects.filter(subdomain='default').first()
                if default_tenant:
                    request.tenant = default_tenant
                    set_current_tenant(default_tenant)

        return result
