import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser, UserManager
from .managers import BaseTenantModel

class TenantStatus(models.TextChoices):
    ACTIVE = 'active', 'نشط'
    TRIAL = 'trial', 'تجريبي'
    EXPIRED = 'expired', 'منتهي'
    SUSPENDED = 'suspended', 'موقوف'

class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, verbose_name="اسم المحل")
    subdomain = models.CharField(max_length=50, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=TenantStatus.choices, default=TenantStatus.TRIAL)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.subdomain})"

class CustomUserManager(UserManager):
    """
    Ensures that user queries are scoped to the current active tenant
    from the thread-local context.
    """
    def get_queryset(self):
        from .managers import get_current_tenant
        tenant = get_current_tenant()
        qs = super().get_queryset()
        if tenant:
            return qs.filter(tenant=tenant)
        return qs

class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('super_admin', 'إدارة النظام'), 
        ('owner', 'صاحب المحل'), 
        ('cashier', 'كاشير')
    ]
    
    tenant = models.ForeignKey(
        Tenant, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='users',
        db_index=True 
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='cashier')

    # Assign custom manager for automatic tenant filtering
    objects = CustomUserManager()
    all_objects = UserManager() # Global manager for admin/tasks

    def __str__(self):
        return f"{self.username} ({self.role})"

class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='audit_logs')
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=255, null=True, blank=True)
    entity_type = models.CharField(max_length=100)
    before_data = models.JSONField(default=dict, blank=True)
    after_data = models.JSONField(default=dict, blank=True)
    delta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise PermissionError("Tinkering with an AuditLog record is strictly prohibited!")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("Deleting an AuditLog is strictly prohibited!")

    def __str__(self):
        return f"{self.action} on {self.entity_type} {self.entity_id}"

class TenantDailySnapshot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='daily_snapshots')
    date = models.DateField(auto_now_add=True)
    
    sales_count = models.IntegerField(default=0)
    sales_total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    cash_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    credit_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    settlements_count = models.IntegerField(default=0)
    commissions_earned = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    active_users = models.IntegerField(default=0)
    login_count = models.IntegerField(default=0)
    last_activity = models.DateTimeField(null=True, blank=True)
    
    error_count = models.IntegerField(default=0)
    warning_count = models.IntegerField(default=0)

    class Meta:
        unique_together = ('tenant', 'date')

    def __str__(self):
        return f"Snapshot for {self.tenant.name} on {self.date}"
