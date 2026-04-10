import uuid
from django.db import models
from core.models import Tenant

class DealType(models.TextChoices):
    COMMISSION = 'commission', 'كمسيون (حِسبة)'
    DIRECT_PURCHASE = 'direct_purchase', 'شراء مباشر'

class CommissionType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=200, verbose_name="اسم العمولة")
    calc_type = models.CharField(max_length=20, choices=[('percent', 'نسبة مئوية (%)'), ('fixed', 'مبلغ ثابت (ج)')], default='percent', verbose_name="نوع الحساب")
    default_rate = models.DecimalField(max_digits=8, decimal_places=3, default=0.00, verbose_name="نسبة/قيمة العمولة")

    class Meta:
        verbose_name = 'نوع العمولة'
        verbose_name_plural = 'أنواع العمولات'

    def __str__(self):
        return f"{self.name} - {self.default_rate}"

class Supplier(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=200, verbose_name="اسم المزارع")
    phone = models.CharField(max_length=20, null=True, blank=True, verbose_name="رقم الهاتف")
    deal_type = models.CharField(max_length=20, choices=DealType.choices, default=DealType.COMMISSION, verbose_name="نوع التعامل")
    
    # Updated: Link Supplier to CommissionType via ForeignKey
    commission_type = models.ForeignKey(CommissionType, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="نوع العمولة المرتبط")
    
    balance = models.DecimalField(max_digits=12, decimal_places=3, default=0.00, verbose_name="رصيد الحساب")
    whatsapp_number = models.CharField(max_length=20, null=True, blank=True, verbose_name="رقم واتساب")
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    notes     = models.TextField(blank=True, null=True, verbose_name="ملاحظات")

    class Meta:
        verbose_name = 'المزارع'
        verbose_name_plural = 'المزارعين'

    def __str__(self):
        return self.name

class CustomerType(models.TextChoices):
    TRADER = 'trader', 'تاجر / زبون دائم'
    RETAIL = 'retail', 'قطاعي / تجزئة'
    INDIVIDUAL = 'individual', 'فردي'

class Customer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=200, verbose_name="اسم الزبون / تاجر")
    phone = models.CharField(max_length=20, null=True, blank=True, verbose_name="رقم الهاتف")
    customer_type = models.CharField(max_length=20, choices=CustomerType.choices, default=CustomerType.TRADER, verbose_name="تصنيف الزبون")
    credit_balance = models.DecimalField(max_digits=12, decimal_places=3, default=0.00, verbose_name="رصيد المديونية")
    credit_limit = models.DecimalField(max_digits=12, decimal_places=3, default=0.00, verbose_name="حد الائتمان")
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    notes     = models.TextField(blank=True, null=True, verbose_name="ملاحظات")

    class Meta:
        verbose_name = 'الزبون / تاجر'
        verbose_name_plural = 'الزبائن / تجار'

    def __str__(self):
        return self.name
