from django.db import models
import threading

# Thread-local storage to securely store the current tenant from middleware
_thread_locals = threading.local()

def get_current_tenant():
    """Returns the current tenant from thread-local storage."""
    return getattr(_thread_locals, 'tenant', None)

def set_current_tenant(tenant):
    """Sets the current tenant in thread-local storage."""
    _thread_locals.tenant = tenant

class TenantManager(models.Manager):
    """Manager that automatically filters querysets by the current active tenant."""
    def get_queryset(self):
        tenant = get_current_tenant()
        qs = super().get_queryset()
        if tenant:
            return qs.filter(tenant=tenant)
        return qs

class BaseTenantModel(models.Model):
    """
    Abstract base model for all tenant-specific data.
    Ensures every record is linked to a tenant and filtered automatically.
    """
    tenant = models.ForeignKey(
        'core.Tenant', 
        on_delete=models.CASCADE, 
        db_index=True,
        related_name="%(class)s_records"
    )
    
    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True
