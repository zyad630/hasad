from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.settings import api_settings
from core.managers import set_current_tenant
from core.models import CustomUser

class TenantJWTAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication that sets request.tenant to the authenticated user's tenant
    if the middleware didn't find a subdomain (e.g. on localhost or bare domains).
    """
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, token = result
            request_tenant = getattr(request, 'tenant', None)

            if request_tenant and user.role != 'super_admin':
                if not user.tenant_id or user.tenant_id != request_tenant.id:
                    raise AuthenticationFailed('Cross-tenant access denied.')

            # Try to attach the user's tenant to the request
            # if it was not already resolved via subdomain
            if not request_tenant and user.tenant:
                request.tenant = user.tenant
                set_current_tenant(user.tenant)
            
            # Allow super_admin to act as Default tenant if they have none
            # just so they can test the UI without crashing
            elif not request_tenant and user.role == 'super_admin':
                from core.models import Tenant
                default_tenant = Tenant.objects.filter(subdomain='default').first()
                if default_tenant:
                    request.tenant = default_tenant
                    set_current_tenant(default_tenant)

        return result

    def get_user(self, validated_token):
        try:
            user_id = validated_token[api_settings.USER_ID_CLAIM]
        except KeyError:
            raise AuthenticationFailed('Token contained no recognizable user identification')

        try:
            user = CustomUser.all_objects.get(**{api_settings.USER_ID_FIELD: user_id})
        except CustomUser.DoesNotExist:
            raise AuthenticationFailed('User not found', code='user_not_found')

        if not user.is_active:
            raise AuthenticationFailed('User is inactive', code='user_inactive')

        return user
