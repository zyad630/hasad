from rest_framework.permissions import BasePermission

class IsManagerOrOwner(BasePermission):
    ALLOWED_ROLES = {'owner', 'manager'}
    message = 'ليس لديك صلاحية تنفيذ هذا الإجراء المالي'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            getattr(request.user, 'role', None) in self.ALLOWED_ROLES
        )

class IsSuperAdmin(BasePermission):
    message = 'هذه الصفحة للمشرف العام فقط'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            getattr(request.user, 'role', None) == 'super_admin'
        )

class IsCashierOrAbove(BasePermission):
    ALLOWED_ROLES = {'cashier', 'manager', 'owner', 'super_admin'}

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            getattr(request.user, 'role', None) in self.ALLOWED_ROLES
        )
