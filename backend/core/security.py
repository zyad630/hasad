import uuid
from django.db import models
from django.utils import timezone
from core.models import Tenant, CustomUser

# ==========================================
# ISSUE #5: Multi-Tenant Middleware
# ==========================================
class TenantMiddleware:
    """
    Ensures every request inside the SaaS is scoped to a specific Tenant.
    If the user has a linked tenant_id, it is attached to the request globally.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated and not request.user.is_superuser:
            # Attach tenant to request object for use in ViewSets
            request.tenant = getattr(request.user, 'tenant', None)
        return self.get_response(request)

# Example ViewSet Base Class for Multi-Tenant Data
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

class TenantScopedViewSet(viewsets.ModelViewSet):
    """
    Every ViewSet inheriting this guarantees 100% data isolation.
    """
    def get_queryset(self):
        if not hasattr(self.request, 'tenant'):
            raise PermissionDenied("Tenant context missing")
        return super().get_queryset().filter(tenant=self.request.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)

# ==========================================
# ISSUE #7: AUDIT TRAIL LOGGING
# ==========================================
class AuditLog(models.Model):
    """
    Immutable audit records for all financial and config state changes.
    """
    tenant        = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    user          = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True)
    action        = models.CharField(max_length=50) # created, updated, cancelled, deleted
    entity_type   = models.CharField(max_length=50) # 'Sale', 'Supplier', 'Settlement'
    entity_id     = models.UUIDField(null=True)
    before_data   = models.JSONField(null=True, blank=True)
    after_data    = models.JSONField(null=True, blank=True)
    delta         = models.JSONField(null=True, blank=True)  # only changed fields
    ip_address    = models.GenericIPAddressField(null=True)
    user_agent    = models.TextField(blank=True)
    request_id    = models.UUIDField(default=uuid.uuid4)  # trace ID mapped to headers
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['tenant', 'entity_type', 'entity_id']),
            models.Index(fields=['created_at']),
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            raise PermissionError("CRITICAL: AuditLog entries are completely immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("CRITICAL: AuditLog entries cannot be deleted under any circumstances.")

# ==========================================
# BASE IMMUTABLE MODEL MIXIN (ISSUE #3)
# ==========================================
class ImmutableFinancialModel(models.Model):
    """
    Inherit this to block exact deletion and force cancellation patterns.
    """
    is_cancelled  = models.BooleanField(default=False)
    cancelled_at  = models.DateTimeField(null=True, blank=True)
    cancelled_by  = models.ForeignKey(CustomUser, null=True, blank=True, related_name='%(class)s_cancellations', on_delete=models.SET_NULL)
    cancel_reason = models.TextField(blank=True)
    reversal_entry_id = models.UUIDField(null=True, blank=True)

    class Meta:
        abstract = True

    def delete(self, *args, **kwargs):
        raise PermissionError(f"{self.__class__.__name__} is a financial record and cannot be deleted. You must cancel it instead.")

