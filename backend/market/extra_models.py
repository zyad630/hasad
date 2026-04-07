"""
Modules 3–7: Additional models
- Module 3: ItemUnit (multi-unit per item)
- Module 4: SalesOrder, PurchaseOrder
- Module 5: SaleReturn, PurchaseReturn
- Module 6: Employee, PayrollRun, PayrollLine
- Module 7: Enhanced Check with full lifecycle
"""
import uuid
from decimal import Decimal
from django.db import models
from django.core.exceptions import PermissionDenied
from core.models import Tenant, CustomUser
from suppliers.models import Supplier, Customer


# ═══════════════════════════════════════════════════════════════════════════════
# Module 3 — Multi-Unit Support per Item
# ═══════════════════════════════════════════════════════════════════════════════

class ItemUnit(models.Model):
    """Additional units for an Item with per-unit pricing (Module 3)."""
    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant            = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    item              = models.ForeignKey('inventory.Item', on_delete=models.CASCADE, related_name='units', verbose_name="الصنف")
    unit_name         = models.CharField(max_length=50, verbose_name="اسم الوحدة")
    conversion_factor = models.DecimalField(max_digits=10, decimal_places=4, default=1, verbose_name="معامل التحويل من الوحدة الأساسية")
    buy_price         = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="سعر الشراء")
    sell_price        = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="سعر البيع")
    is_default        = models.BooleanField(default=False, verbose_name="وحدة افتراضية؟")

    class Meta:
        verbose_name = 'وحدة صنف'
        verbose_name_plural = 'وحدات الأصناف'
        unique_together = [('tenant', 'item', 'unit_name')]

    def __str__(self):
        return f"{self.item.name} — {self.unit_name}"


# ═══════════════════════════════════════════════════════════════════════════════
# Module 4 — Sales Orders & Purchase Orders
# ═══════════════════════════════════════════════════════════════════════════════

class OrderStatus(models.TextChoices):
    DRAFT     = 'draft',     'مسودة'
    PENDING   = 'pending',   'قيد الانتظار'
    CONFIRMED = 'confirmed', 'مؤكد'
    DELIVERED = 'delivered', 'تم التسليم / تحول لفاتورة'
    CANCELLED = 'cancelled', 'ملغي'


class SalesOrder(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant       = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    customer     = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="الزبون")
    order_date   = models.DateField(auto_now_add=True, verbose_name="تاريخ الطلب")
    status       = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING, verbose_name="الحالة")
    notes        = models.TextField(blank=True, null=True, verbose_name="ملاحظات")
    converted_sale = models.OneToOneField('sales.Sale', on_delete=models.SET_NULL, null=True, blank=True, related_name='source_order', verbose_name="الفاتورة المحولة")
    created_by   = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="بواسطة")
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'طلب بيع'
        verbose_name_plural = 'طلبات البيع'
        indexes = [models.Index(fields=['tenant', 'status'])]

    def __str__(self):
        return f"طلب بيع #{self.id} — {self.customer}"


class SalesOrderItem(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order        = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name='items')
    item         = models.ForeignKey('inventory.Item', on_delete=models.PROTECT, verbose_name="الصنف")
    unit         = models.ForeignKey(ItemUnit, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="الوحدة")
    quantity     = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الكمية")
    unit_price   = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="السعر")
    subtotal     = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="الإجمالي الفرعي")

    class Meta:
        verbose_name = 'بند طلب بيع'
        verbose_name_plural = 'بنود طلبات البيع'


class PurchaseOrder(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant       = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    supplier     = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="المورد / المزارع")
    order_date   = models.DateField(auto_now_add=True, verbose_name="تاريخ الطلب")
    status       = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING, verbose_name="الحالة")
    notes        = models.TextField(blank=True, null=True, verbose_name="ملاحظات")
    converted_shipment = models.OneToOneField('inventory.Shipment', on_delete=models.SET_NULL, null=True, blank=True, related_name='source_order', verbose_name="الإرسالية المحولة")
    created_by   = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="بواسطة")
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'أمر شراء'
        verbose_name_plural = 'أوامر الشراء'

    def __str__(self):
        return f"أمر شراء #{self.id} — {self.supplier}"


class PurchaseOrderItem(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order      = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    item       = models.ForeignKey('inventory.Item', on_delete=models.PROTECT, verbose_name="الصنف")
    unit       = models.ForeignKey(ItemUnit, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="الوحدة")
    quantity   = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الكمية")
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="السعر")
    subtotal   = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="الإجمالي الفرعي")

    class Meta:
        verbose_name = 'بند أمر شراء'
        verbose_name_plural = 'بنود أوامر الشراء'


# ═══════════════════════════════════════════════════════════════════════════════
# Module 5 — Sales Return & Purchase Return
# ═══════════════════════════════════════════════════════════════════════════════

class ReturnReason(models.TextChoices):
    DEFECTIVE  = 'defective',  'بضاعة تالفة'
    WRONG_ITEM = 'wrong_item', 'صنف خاطئ'
    EXCESS     = 'excess',     'كمية زائدة'
    OTHER      = 'other',      'أخرى'


class SaleReturn(models.Model):
    """Immutable return record. Never modifies original Sale."""
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant        = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    original_sale = models.ForeignKey('sales.Sale', on_delete=models.PROTECT, related_name='returns', verbose_name="الفاتورة الأصلية")
    return_date   = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإرجاع")
    reason        = models.CharField(max_length=20, choices=ReturnReason.choices, default=ReturnReason.OTHER, verbose_name="سبب الإرجاع")
    notes         = models.TextField(blank=True, null=True, verbose_name="ملاحظات")
    return_amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="قيمة المرتجع")
    created_by    = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="بواسطة")

    def delete(self, *args, **kwargs):
        raise PermissionDenied('سجلات المرتجعات لا يمكن حذفها')

    class Meta:
        verbose_name = 'مرتجع مبيعات'
        verbose_name_plural = 'مرتجعات المبيعات'

    def __str__(self):
        return f"مرتجع فاتورة #{self.original_sale_id}"


class SaleReturnItem(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale_return     = models.ForeignKey(SaleReturn, on_delete=models.CASCADE, related_name='items')
    shipment_item   = models.ForeignKey('inventory.ShipmentItem', on_delete=models.PROTECT, verbose_name="بند الإرسالية")
    quantity        = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الكمية المرتجعة")
    unit_price      = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="السعر")
    subtotal        = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="الإجمالي")

    class Meta:
        verbose_name = 'بند مرتجع مبيعات'
        verbose_name_plural = 'بنود مرتجعات المبيعات'


class PurchaseReturn(models.Model):
    """Return goods to supplier. Never modifies original Shipment."""
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant           = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    original_shipment = models.ForeignKey('inventory.Shipment', on_delete=models.PROTECT, related_name='returns', verbose_name="الإرسالية الأصلية")
    return_date      = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإرجاع")
    reason           = models.CharField(max_length=20, choices=ReturnReason.choices, default=ReturnReason.OTHER, verbose_name="سبب الإرجاع")
    notes            = models.TextField(blank=True, null=True, verbose_name="ملاحظات")
    return_amount    = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="قيمة المرتجع")
    created_by       = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="بواسطة")

    def delete(self, *args, **kwargs):
        raise PermissionDenied('سجلات المرتجعات لا يمكن حذفها')

    class Meta:
        verbose_name = 'مرتجع مشتريات'
        verbose_name_plural = 'مرتجعات المشتريات'

    def __str__(self):
        return f"مرتجع إرسالية #{self.original_shipment_id}"


class PurchaseReturnItem(models.Model):
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase_return  = models.ForeignKey(PurchaseReturn, on_delete=models.CASCADE, related_name='items')
    shipment_item    = models.ForeignKey('inventory.ShipmentItem', on_delete=models.PROTECT, verbose_name="بند الإرسالية")
    quantity         = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الكمية المرتجعة")
    unit_price       = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="السعر")
    subtotal         = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="الإجمالي")

    class Meta:
        verbose_name = 'بند مرتجع مشتريات'
        verbose_name_plural = 'بنود مرتجعات المشتريات'


# ═══════════════════════════════════════════════════════════════════════════════
# Module 6 — Employee & Payroll
# ═══════════════════════════════════════════════════════════════════════════════

class EmployeeStatus(models.TextChoices):
    ACTIVE     = 'active',     'نشط'
    ON_LEAVE   = 'on_leave',   'إجازة'
    TERMINATED = 'terminated', 'منتهي الخدمة'


class Employee(models.Model):
    id                    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant                = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name                  = models.CharField(max_length=200, verbose_name="اسم الموظف")
    national_id           = models.CharField(max_length=50, blank=True, null=True, verbose_name="رقم الهوية")
    phone                 = models.CharField(max_length=20, blank=True, null=True, verbose_name="رقم الهاتف")
    job_title             = models.CharField(max_length=100, blank=True, null=True, verbose_name="المسمى الوظيفي")
    basic_salary          = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="الراتب الأساسي")
    working_days_per_month = models.IntegerField(default=26, verbose_name="أيام العمل في الشهر")
    hire_date             = models.DateField(verbose_name="تاريخ التعيين")
    status                = models.CharField(max_length=20, choices=EmployeeStatus.choices, default=EmployeeStatus.ACTIVE, verbose_name="الحالة")
    notes                 = models.TextField(blank=True, null=True, verbose_name="ملاحظات")

    class Meta:
        verbose_name = 'موظف'
        verbose_name_plural = 'الموظفون'

    def __str__(self):
        return self.name

    def daily_rate(self):
        """Calculate daily wage based on monthly salary."""
        return Decimal(str(self.basic_salary)) / Decimal(str(self.working_days_per_month))


class PayrollRun(models.Model):
    """One payroll run for a given month."""
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant     = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    run_date   = models.DateField(verbose_name="تاريخ الصرف")
    period     = models.CharField(max_length=20, verbose_name="الفترة (مثلاً: 2026-04)")
    notes      = models.TextField(blank=True, null=True, verbose_name="ملاحظات")
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="بواسطة")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'تشغيل رواتب'
        verbose_name_plural = 'تشغيلات الرواتب'

    def __str__(self):
        return f"رواتب {self.period}"


class PayrollLine(models.Model):
    """One line per employee in a PayrollRun."""
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payroll_run      = models.ForeignKey(PayrollRun, on_delete=models.CASCADE, related_name='lines')
    employee         = models.ForeignKey(Employee, on_delete=models.PROTECT, verbose_name="الموظف")
    days_worked      = models.IntegerField(verbose_name="أيام العمل الفعلية")
    basic_salary     = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="الراتب الأساسي")
    deductions       = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="الاستقطاعات")
    bonuses          = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="المكافآت")
    net_salary       = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="صافي الراتب")
    ledger_posted    = models.BooleanField(default=False, verbose_name="تم الترحيل المحاسبي؟")

    class Meta:
        verbose_name = 'بند راتب'
        verbose_name_plural = 'بنود الرواتب'

    def __str__(self):
        return f"{self.employee.name} — {self.net_salary}"


# ═══════════════════════════════════════════════════════════════════════════════
# Module 7 — Advanced Check Management
# ═══════════════════════════════════════════════════════════════════════════════

class CheckDirection(models.TextChoices):
    INCOMING = 'incoming', 'وارد (من الزبون)'
    OUTGOING = 'outgoing', 'صادر (للمورد)'


class CheckLifecycle(models.TextChoices):
    IN_WALLET  = 'in_wallet',  'في المحفظة'
    DEPOSITED  = 'deposited',  'تم الإيداع'
    CLEARED    = 'cleared',    'تم التحصيل (مقبول)'
    BOUNCED    = 'bounced',    'مرتجع (شيك ناقص)'
    CANCELLED  = 'cancelled',  'ملغي'


class AdvancedCheck(models.Model):
    """Full check lifecycle model (Module 7)."""
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant        = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    check_number  = models.CharField(max_length=50, verbose_name="رقم الشيك")
    bank_name     = models.CharField(max_length=100, verbose_name="اسم البنك")
    branch        = models.CharField(max_length=100, blank=True, null=True, verbose_name="الفرع")
    due_date      = models.DateField(verbose_name="تاريخ الاستحقاق")
    amount        = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="المبلغ")
    currency_code = models.CharField(max_length=10, default='ILS', verbose_name="العملة")

    direction     = models.CharField(max_length=10, choices=CheckDirection.choices, default=CheckDirection.INCOMING, verbose_name="اتجاه الشيك")
    lifecycle     = models.CharField(max_length=20, choices=CheckLifecycle.choices, default=CheckLifecycle.IN_WALLET, verbose_name="حالة الشيك")

    # Party
    customer      = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="الزبون (شيك وارد)")
    supplier      = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="المورد (شيك صادر)")
    drawer_name   = models.CharField(max_length=150, blank=True, null=True, verbose_name="اسم الساحب")

    # Lifecycle timestamps
    deposited_at  = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الإيداع")
    cleared_at    = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ التحصيل")
    bounced_at    = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الرجوع")
    bounce_reason = models.TextField(blank=True, null=True, verbose_name="سبب الرجوع")

    created_by    = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="بواسطة")
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'شيك'
        verbose_name_plural = 'الشيكات'
        indexes = [
            models.Index(fields=['tenant', 'lifecycle']),
            models.Index(fields=['tenant', 'due_date']),
        ]

    def __str__(self):
        return f"شيك #{self.check_number} — {self.bank_name} ({self.lifecycle})"
