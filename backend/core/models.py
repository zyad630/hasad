import uuid
from django.db import models
from django.core.serializers.json import DjangoJSONEncoder
from django.contrib.auth.models import AbstractUser, UserManager
from .managers import BaseTenantModel

class TenantStatus(models.TextChoices):
    ACTIVE = 'active', 'نشط'
    TRIAL = 'trial', 'تجريبي'
    EXPIRED = 'expired', 'منتهي'
    SUSPENDED = 'suspended', 'موقوف'

class Currency(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('Tenant', on_delete=models.CASCADE, related_name='tenant_currencies')
    code = models.CharField(max_length=10, verbose_name="كود العملة (مثل ILS)")
    name = models.CharField(max_length=50, verbose_name="اسم العملة")
    symbol = models.CharField(max_length=5, verbose_name="الرمز")
    is_base = models.BooleanField(default=False, verbose_name="العملة الأساسية؟")

    class Meta:
        verbose_name = 'العملة'
        verbose_name_plural = 'العملات'
        unique_together = ('tenant', 'code')

    def save(self, *args, **kwargs):
        # If this is the first currency for the tenant, make it base automatically
        if not Currency.objects.filter(tenant=self.tenant).exists():
            self.is_base = True

        if self.is_base:
            # Atomic update to unset other base currencies for this tenant
            Currency.objects.filter(tenant=self.tenant).exclude(id=self.id).update(is_base=False)
            
            # Sync with Tenant model if needed (though we rely on Currency.is_base now)
            # We keep the Tenant redundant fields for quick access in queries
            self.tenant.base_currency_code = self.code
            self.tenant.base_currency_symbol = self.symbol
            self.tenant.save()

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.code})"

class CurrencyExchangeRate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('Tenant', on_delete=models.CASCADE, related_name='exchange_rates')
    currency = models.ForeignKey(Currency, on_delete=models.CASCADE, related_name='rates')
    rate = models.DecimalField(max_digits=18, decimal_places=6, verbose_name="سعر الصرف")
    date = models.DateField(verbose_name="تاريخ التسعيرة")
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('CustomUser', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = 'سعر صرف'
        verbose_name_plural = 'أسعار الصرف'
        unique_together = ('tenant', 'currency', 'date')

    def __str__(self):
        return f"{self.currency.code} = {self.rate} on {self.date}"

class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, verbose_name="اسم المحل / الوكالة")
    subdomain = models.CharField(max_length=50, unique=True, db_index=True, verbose_name="رابط الموقع (Subdomain)")
    status = models.CharField(max_length=20, choices=TenantStatus.choices, default=TenantStatus.TRIAL, verbose_name="حالة الاشتراك")
    
    # Currency Settings
    base_currency_code = models.CharField(max_length=10, default='ILS', verbose_name="كود العملة الأساسية")
    base_currency_symbol = models.CharField(max_length=5, default='₪', verbose_name="رمز العملة الأساسية")
    trial_ends_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ انتهاء الفترة التجريبية")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        verbose_name = 'المحل / الوكالة'
        verbose_name_plural = 'المحلات والوكالات المشتركة'

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
        db_index=True,
        verbose_name="المحل التابع له"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='cashier', verbose_name="الصلاحية")
    permissions = models.JSONField(default=list, blank=True, encoder=DjangoJSONEncoder, verbose_name="الصلاحيات التفصيلية")

    class Meta:
        verbose_name = 'المستخدم'
        verbose_name_plural = 'المستخدمين'

    # Assign custom manager for automatic tenant filtering
    objects = CustomUserManager()
    all_objects = UserManager() # Global manager for admin/tasks

    def __str__(self):
        return f"{self.username} ({self.role})"

class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='audit_logs', verbose_name="المحل")
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, verbose_name="المستخدم")
    action = models.CharField(max_length=50, verbose_name="الإجراء")
    entity_id = models.CharField(max_length=255, null=True, blank=True, verbose_name="معرف الكيان")
    entity_type = models.CharField(max_length=100, verbose_name="نوع الكيان")
    before_data = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder, verbose_name="البيانات السابقة")
    after_data = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder, verbose_name="البيانات الجديدة")
    delta = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder, verbose_name="الفروقات")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ العملية")

    class Meta:
        verbose_name = 'سجل الرقابة'
        verbose_name_plural = 'سجلات الرقابة والعمليات'

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise PermissionError("التلاعب بسجل الرقابة ممنوع تماماً!")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("حذف سجل الرقابة ممنوع تماماً!")

    def __str__(self):
        return f"{self.action} on {self.entity_type}"

class TenantDailySnapshot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='daily_snapshots', verbose_name="المحل")
    date = models.DateField(auto_now_add=True, verbose_name="التاريخ")
    
    sales_count = models.IntegerField(default=0, verbose_name="عدد المبيعات")
    sales_total = models.DecimalField(max_digits=12, decimal_places=3, default=0.00, verbose_name="إجمالي المبيعات")
    cash_sales = models.DecimalField(max_digits=12, decimal_places=3, default=0.00, verbose_name="المبيعات النقدية")
    credit_sales = models.DecimalField(max_digits=12, decimal_places=3, default=0.00, verbose_name="المبيعات الآجلة")
    
    settlements_count = models.IntegerField(default=0, verbose_name="عدد التصفيات")
    commissions_earned = models.DecimalField(max_digits=12, decimal_places=3, default=0.00, verbose_name="إجمالي العمولات")
    
    active_users = models.IntegerField(default=0, verbose_name="المستخدمين النشطين")
    login_count = models.IntegerField(default=0, verbose_name="عدد مرات الدخول")
    last_activity = models.DateTimeField(null=True, blank=True, verbose_name="آخر نشاط")
    
    error_count = models.IntegerField(default=0, verbose_name="عدد الأخطاء")
    warning_count = models.IntegerField(default=0, verbose_name="عدد التحذيرات")

    class Meta:
        verbose_name = 'ملخص الأداء اليومي'
        verbose_name_plural = 'ملخصات الأداء اليومية'
        unique_together = ('tenant', 'date')

    def __str__(self):
        return f"Snapshot for {self.tenant.name} on {self.date}"
