import uuid
from django.db import models
from core.models import Tenant
from suppliers.models import Supplier
from inventory.models import Shipment

class AccountGroup(models.Model):
    TYPES = [
        ('asset', 'أصول'),
        ('liability', 'خصوم'),
        ('equity', 'حقوق ملكية'),
        ('revenue', 'إيرادات'),
        ('expense', 'مصروفات'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=150, verbose_name="اسم المجموعة")
    code = models.CharField(max_length=20, null=True, blank=True, verbose_name="كود المجموعة")
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subgroups', verbose_name="المجموعة الأب")
    account_type = models.CharField(max_length=20, choices=TYPES, verbose_name="نوع الحساب")

    class Meta:
        verbose_name = 'مجموعة حسابات'
        verbose_name_plural = 'مجموعات الحسابات'
        unique_together = ('tenant', 'code')

    def __str__(self):
        return f"{self.code} - {self.name}" if self.code else self.name


class Account(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    group = models.ForeignKey(AccountGroup, on_delete=models.CASCADE, related_name='accounts', verbose_name="المجموعة")
    name = models.CharField(max_length=150, verbose_name="اسم الحساب")
    code = models.CharField(max_length=50, null=True, blank=True, verbose_name="كود الحساب")
    is_active = models.BooleanField(default=True, verbose_name="نشط")

    class Meta:
        verbose_name = 'حساب مالي'
        verbose_name_plural = 'شجرة الحسابات'
        unique_together = ('tenant', 'code')

    def __str__(self):
        return f"{self.code} - {self.name}" if self.code else self.name


class Settlement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    shipment = models.OneToOneField(Shipment, on_delete=models.PROTECT, unique=True, verbose_name="الإرسالية")
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, verbose_name="المزارع")
    currency_code = models.CharField(max_length=10, default='ILS', verbose_name="العملة")
    total_sales = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="إجمالي المبيعات")
    commission_amount = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="قيمة العمولة")
    total_expenses = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="إجمالي المصروفات")
    net_supplier = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الصافي المستحق للمزارع")
    is_paid = models.BooleanField(default=False, verbose_name="تم الدفع؟")
    settled_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ التصفية")

    class Meta:
        verbose_name = 'تصفية إرسالية'
        verbose_name_plural = 'تصفية الإرساليات'

    def __str__(self):
        return f"تصفية {self.shipment}"

class Bank(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, verbose_name="اسم البنك")
    account_number = models.CharField(max_length=50, blank=True, null=True, verbose_name="رقم الحساب")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'بنك'
        verbose_name_plural = 'البنوك'
    
    def __str__(self):
        return self.name

class ExpenseCategory(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, verbose_name="اسم التصنيف")
    
    class Meta:
        verbose_name = 'تصنيف مصروف'
        verbose_name_plural = 'تصنيفات المصاريف'

    def __str__(self):
        return self.name

class RevenueCategory(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, verbose_name="اسم التصنيف")
    
    class Meta:
        verbose_name = 'تصنيف إيراد'
        verbose_name_plural = 'تصنيفات الإيرادات'

    def __str__(self):
        return self.name

class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    shipment = models.ForeignKey(Shipment, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses', verbose_name="مرتبط بإرسالية")
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, null=True, blank=True, verbose_name="تصنيف المصروف")
    currency_code  = models.CharField(max_length=10, default='ILS', verbose_name="العملة")
    foreign_amount = models.DecimalField(max_digits=18, decimal_places=3, verbose_name="المبلغ (عملة الحركة)")
    exchange_rate  = models.DecimalField(max_digits=18, decimal_places=6, default=1, verbose_name="سعر الصرف")
    base_amount    = models.DecimalField(max_digits=18, decimal_places=3, verbose_name="المبلغ (عملة الأساس / شيكل)")
    description = models.TextField(blank=True, null=True, verbose_name="البيان / الوصف")
    expense_date = models.DateField(verbose_name="تاريخ الصرف")

    class Meta:
        verbose_name = 'مصروف'
        verbose_name_plural = 'المصروفات'

    def __str__(self):
        return f"{self.category.name if self.category else 'مصروف'} - {self.foreign_amount} {self.currency_code}"

class CashTxType(models.TextChoices):
    IN = 'in', 'وارد (إيداع)'
    OUT = 'out', 'منصرف (دفع)'

class CheckStatus(models.TextChoices):
    PENDING = 'pending', 'قيد الانتظار'
    CASHED = 'cashed', 'تم تحصيله'
    RETURNED = 'returned', 'مرتجع'
    CANCELLED = 'cancelled', 'ملغي'

class Check(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    check_number = models.CharField(max_length=50, verbose_name="رقم الشيك")
    bank_name = models.CharField(max_length=100, verbose_name="اسم البنك")
    due_date = models.DateField(verbose_name="تاريخ الاستحقاق")
    
    currency_code  = models.CharField(max_length=10, default='ILS', verbose_name="العملة")
    foreign_amount = models.DecimalField(max_digits=18, decimal_places=3, verbose_name="المبلغ (عملة الحركة)")
    exchange_rate  = models.DecimalField(max_digits=18, decimal_places=6, default=1, verbose_name="سعر الصرف")
    base_amount    = models.DecimalField(max_digits=18, decimal_places=3, verbose_name="المبلغ (العملة الأساسية)")

    status = models.CharField(max_length=20, choices=CheckStatus.choices, default=CheckStatus.PENDING, verbose_name="حالة الشيك")
    drawer_name = models.CharField(max_length=150, null=True, blank=True, verbose_name="صاحب الشيك / الساحب")
    daily_movement = models.ForeignKey('market.DailyMovement', on_delete=models.SET_NULL, null=True, blank=True, related_name='checks', verbose_name="مرتبط بحركة ساحة")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'شيك'
        verbose_name_plural = 'الشيكات'

    def __str__(self):
        return f"شيك رقم {self.check_number} - {self.bank_name}"

class CashTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    tx_type = models.CharField(max_length=5, choices=CashTxType.choices, verbose_name="نوع الحركة")
    currency_code  = models.CharField(max_length=10, default='ILS', verbose_name="العملة")
    foreign_amount = models.DecimalField(max_digits=18, decimal_places=3, verbose_name="المبلغ (عملة الحركة)")
    exchange_rate  = models.DecimalField(max_digits=18, decimal_places=6, default=1, verbose_name="سعر الصرف")
    base_amount    = models.DecimalField(max_digits=18, decimal_places=3, verbose_name="المبلغ (العملة الأساسية)")
    is_check = models.BooleanField(default=False, verbose_name="شيك؟")
    check_ref = models.ForeignKey(Check, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions', verbose_name="مرجع الشيك")
    reference_type = models.CharField(max_length=50, blank=True, null=True, verbose_name="نوع المرجع")
    reference_id = models.UUIDField(null=True, blank=True, verbose_name="معرف المرجع")
    description = models.TextField(blank=True, null=True, verbose_name="التفاصيل")
    tx_date = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الحركة")

    class Meta:
        verbose_name = 'حركة خزينة'
        verbose_name_plural = 'حركات الخزينة'

    def __str__(self):
        return f"{self.tx_type} {self.foreign_amount} {self.currency_code} {'(شيك)' if self.is_check else ''}"

from django.db.models import Sum, Q
from decimal import Decimal, ROUND_HALF_UP

class LedgerEntry(models.Model):
    DEBIT  = 'DR'
    CREDIT = 'CR'

    tenant       = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    entry_date   = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ القيد")
    entry_type   = models.CharField(max_length=2, choices=[(DEBIT,'مدين (له)'),(CREDIT,'دائن (عليه)')], verbose_name="نوع القيد")
    currency_code = models.CharField(max_length=10, default='ILS', verbose_name="العملة")
    account_type = models.CharField(max_length=30, verbose_name="نوع الحساب")
    account_id   = models.UUIDField(verbose_name="معرف الحساب")
    foreign_amount = models.DecimalField(max_digits=18, decimal_places=3, verbose_name="المبلغ (عملة الحركة)")
    exchange_rate  = models.DecimalField(max_digits=18, decimal_places=6, default=1, verbose_name="سعر الصرف")
    base_amount    = models.DecimalField(max_digits=18, decimal_places=3, verbose_name="المبلغ (العملة الأساسية)")
    reference_type = models.CharField(max_length=50, verbose_name="نوع المرجع")
    reference_id   = models.UUIDField(verbose_name="معرف المرجع")
    description    = models.CharField(max_length=500, verbose_name="البيان")
    created_by     = models.ForeignKey('core.CustomUser', on_delete=models.SET_NULL, null=True, verbose_name="بواسطة")

    class Meta:
        verbose_name = 'قيد محاسبي'
        verbose_name_plural = 'دفتر الأستاذ (القيود)'
        indexes = [
            models.Index(fields=['tenant', 'account_type', 'account_id']),
            models.Index(fields=['reference_type', 'reference_id']),
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            raise PermissionError("القيود المحاسبية غير قابلة للتعديل - استخدم إدخالات عكسية للتصحيح")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("لا يمكن حذف القيود المحاسبية - السجلات المالية دائمة")

    @classmethod
    def get_balance(cls, tenant, account_type, account_id, currency_code=None, unified_base=False):
        qs = cls.objects.filter(
            tenant=tenant,
            account_type=account_type,
            account_id=account_id
        )
        if not unified_base:
            if currency_code:
                qs = qs.filter(currency_code=currency_code)
            result = qs.aggregate(
                total_dr=Sum('foreign_amount', filter=Q(entry_type=cls.DEBIT)),
                total_cr=Sum('foreign_amount', filter=Q(entry_type=cls.CREDIT)),
            )
        else:
            result = qs.aggregate(
                total_dr=Sum('base_amount', filter=Q(entry_type=cls.DEBIT)),
                total_cr=Sum('base_amount', filter=Q(entry_type=cls.CREDIT)),
            )
        dr = result['total_dr'] or Decimal('0')
        cr = result['total_cr'] or Decimal('0')
        return (dr - cr).quantize(Decimal('0.001'), ROUND_HALF_UP)


# ═══════════════════════════════════════════════════════════════════════════════
# Module 7 — Advanced Check Management (full lifecycle)
# ═══════════════════════════════════════════════════════════════════════════════

class CheckDirection(models.TextChoices):
    INCOMING = 'incoming', 'وارد (من الزبون)'
    OUTGOING = 'outgoing', 'صادر (للمورد)'


class CheckLifecycle(models.TextChoices):
    IN_WALLET = 'in_wallet', 'في المحفظة'
    DEPOSITED = 'deposited', 'تم الإيداع'
    CLEARED   = 'cleared',   'تم التحصيل (مقبول)'
    BOUNCED   = 'bounced',   'مرتجع (شيك ناقص)'
    CANCELLED = 'cancelled', 'ملغي'


class AdvancedCheck(models.Model):
    """Full check lifecycle — immutable once cleared or bounced."""
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant        = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    check_number  = models.CharField(max_length=50, verbose_name="رقم الشيك")
    bank_name     = models.CharField(max_length=100, verbose_name="اسم البنك")
    branch        = models.CharField(max_length=100, blank=True, null=True, verbose_name="الفرع")
    due_date      = models.DateField(verbose_name="تاريخ الاستحقاق")
    
    currency_code  = models.CharField(max_length=10, default='ILS', verbose_name="العملة")
    foreign_amount = models.DecimalField(max_digits=18, decimal_places=3, verbose_name="المبلغ (عملة الحركة)")
    exchange_rate  = models.DecimalField(max_digits=18, decimal_places=6, default=1, verbose_name="سعر الصرف")
    base_amount    = models.DecimalField(max_digits=18, decimal_places=3, verbose_name="المبلغ (العملة الأساسية)")

    direction     = models.CharField(max_length=10, choices=CheckDirection.choices,
                                     default=CheckDirection.INCOMING, verbose_name="اتجاه الشيك")
    lifecycle     = models.CharField(max_length=20, choices=CheckLifecycle.choices,
                                     default=CheckLifecycle.IN_WALLET, verbose_name="حالة الشيك")

    # Related parties (one will be set based on direction)
    customer      = models.ForeignKey('suppliers.Customer', on_delete=models.SET_NULL,
                                      null=True, blank=True, verbose_name="الزبون (شيك وارد)")
    supplier      = models.ForeignKey('suppliers.Supplier', on_delete=models.SET_NULL,
                                      null=True, blank=True, verbose_name="المورد (شيك صادر)")
    drawer_name   = models.CharField(max_length=150, blank=True, null=True, verbose_name="اسم الساحب")

    # Lifecycle audit timestamps
    deposited_at  = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الإيداع")
    cleared_at    = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ التحصيل")
    bounced_at    = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الرجوع")
    bounce_reason = models.TextField(blank=True, null=True, verbose_name="سبب الرجوع")

    created_by    = models.ForeignKey('core.CustomUser', on_delete=models.SET_NULL,
                                      null=True, blank=True, verbose_name="بواسطة")
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'شيك (متقدم)'
        verbose_name_plural = 'الشيكات (متقدم)'
        indexes = [
            models.Index(fields=['tenant', 'lifecycle']),
            models.Index(fields=['tenant', 'due_date']),
            models.Index(fields=['tenant', 'direction']),
        ]

    def __str__(self):
        return f"شيك #{self.check_number} — {self.bank_name} ({self.lifecycle})"

    def can_transition_to(self, new_lifecycle: str) -> bool:
        """Valid lifecycle transitions."""
        allowed = {
            CheckLifecycle.IN_WALLET: [CheckLifecycle.DEPOSITED, CheckLifecycle.CANCELLED],
            CheckLifecycle.DEPOSITED: [CheckLifecycle.CLEARED, CheckLifecycle.BOUNCED],
            CheckLifecycle.CLEARED:   [],  # Terminal state
            CheckLifecycle.BOUNCED:   [],  # Terminal state
            CheckLifecycle.CANCELLED: [],  # Terminal state
        }
        return new_lifecycle in allowed.get(self.lifecycle, [])


class Partner(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=150, verbose_name="اسم الشريك")
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="رقم الهاتف")
    share_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name="نسبة الشراكة (%)")
    initial_capital = models.DecimalField(max_digits=18, decimal_places=3, default=0, verbose_name="رأس المال المبدئي")
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True, verbose_name="ملاحظات")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'شريك'
        verbose_name_plural = 'الشركاء والمساهمون'

    def __str__(self):
        return f"{self.name} ({self.share_percentage}%)"

class JournalVoucher(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    voucher_date = models.DateField(auto_now_add=True, verbose_name="تاريخ المستند")
    currency_code = models.CharField(max_length=10, default='ILS', verbose_name="العملة")
    exchange_rate = models.DecimalField(max_digits=18, decimal_places=6, default=1, verbose_name="سعر الصرف")
    amount = models.DecimalField(max_digits=18, decimal_places=3, verbose_name="المبلغ")
    base_amount = models.DecimalField(max_digits=18, decimal_places=3, verbose_name="المبلغ (بالأساس)")
    description = models.TextField(blank=True, null=True, verbose_name="البيان")

    dr_account_type = models.CharField(max_length=50, verbose_name="نوع حساب المدين")
    dr_account_id = models.UUIDField(verbose_name="معرف حساب المدين")
    dr_account_name = models.CharField(max_length=150, null=True, blank=True, verbose_name="اسم حساب المدين")

    cr_account_type = models.CharField(max_length=50, verbose_name="نوع حساب الدائن")
    cr_account_id = models.UUIDField(verbose_name="معرف حساب الدائن")
    cr_account_name = models.CharField(max_length=150, null=True, blank=True, verbose_name="اسم حساب الدائن")

    created_by = models.ForeignKey('core.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, verbose_name="بواسطة")

    class Meta:
        verbose_name = 'مستند قيد'
        verbose_name_plural = 'مستندات القيد'

    def __str__(self):
        return f"قيد #{self.id} - {self.amount} {self.currency_code}"
