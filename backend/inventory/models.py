import uuid
from django.db import models
from core.models import Tenant
from suppliers.models import Supplier, DealType

class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, verbose_name="اسم التصنيف")

    class Meta:
        verbose_name = 'التصنيف'
        verbose_name_plural = 'التصنيفات'

    def __str__(self):
        return self.name

class BaseUnit(models.TextChoices):
    KG = 'kg', 'كيلوجرام'
    BOX = 'box', 'صندوق / قفص'
    SACK = 'sack', 'شوال'
    BUNCH = 'bunch', 'ربطة'

class Item(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="التصنيف")
    name = models.CharField(max_length=200, verbose_name="اسم الصنف")
    base_unit = models.CharField(max_length=10, choices=BaseUnit.choices, default=BaseUnit.KG, verbose_name="وحدة القياس")
    waste_percentage = models.DecimalField(max_digits=5, decimal_places=3, default=0.00, verbose_name="نسبة الهالك (%)")
    box_price = models.DecimalField(max_digits=10, decimal_places=3, default=0.00, verbose_name="ثمن الكرتون (افتراضي)")
    tare_weight = models.DecimalField(max_digits=8, decimal_places=3, default=0.0, verbose_name="وزن الفارغ / التارة (كجم لكل وحدة)")
    tare_unit = models.CharField(max_length=10, default='kg', verbose_name="وحدة التارة")
    price_on = models.CharField(max_length=10, choices=[('gross', 'القائم (إجمالي)'), ('net', 'الصافي')], default='net', verbose_name="احتساب السعر على")
    is_active = models.BooleanField(default=True, verbose_name="نشط")

    class Meta:
        verbose_name = 'الصنف'
        verbose_name_plural = 'الأصناف'

    def __str__(self):
        return self.name


# ── Module 3: ItemUnit — multi-unit support per item ──────────────────────────

class ItemUnit(models.Model):
    """Define additional units for an Item with per-unit buy/sell price."""
    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant            = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    item              = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='units', verbose_name="الصنف")
    unit_name         = models.CharField(max_length=50, verbose_name="اسم الوحدة")
    conversion_factor = models.DecimalField(max_digits=10, decimal_places=4, default=1, verbose_name="معامل التحويل من الوحدة الأساسية")
    buy_price         = models.DecimalField(max_digits=10, decimal_places=3, default=0, verbose_name="سعر الشراء")
    sell_price        = models.DecimalField(max_digits=10, decimal_places=3, default=0, verbose_name="سعر البيع")
    is_default        = models.BooleanField(default=False, verbose_name="وحدة افتراضية؟")

    class Meta:
        verbose_name = 'وحدة صنف'
        verbose_name_plural = 'وحدات الأصناف'
        unique_together = [('tenant', 'item', 'unit_name')]
        indexes = [models.Index(fields=['tenant', 'item'])]

    def __str__(self):
        return f"{self.item.name} — {self.unit_name}"

class UnitConversion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='conversions', verbose_name="الصنف")
    from_unit = models.CharField(max_length=20, verbose_name="من وحدة")
    to_unit = models.CharField(max_length=20, verbose_name="إلى وحدة")
    factor = models.DecimalField(max_digits=10, decimal_places=4, verbose_name="معامل التحويل")

    class Meta:
        verbose_name = 'معامل تحويل'
        verbose_name_plural = 'معاملات التحويل'

class ShipmentStatus(models.TextChoices):
    OPEN = 'open', 'مفتوحة (قيد البيع)'
    SETTLED = 'settled', 'تمت التصفية'

class Shipment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, verbose_name="المزارع")
    shipment_date = models.DateField(verbose_name="تاريخ الإرسالية")
    deal_type = models.CharField(max_length=20, choices=DealType.choices, default=DealType.COMMISSION, verbose_name="نظام التعامل")
    status = models.CharField(max_length=20, choices=ShipmentStatus.choices, default=ShipmentStatus.OPEN, verbose_name="حالة الإرسالية")
    notes = models.TextField(blank=True, null=True, verbose_name="ملاحظات")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")

    class Meta:
        verbose_name = 'الإرسالية'
        verbose_name_plural = 'الإرساليات'

    def __str__(self):
        return f"إرسالية {self.supplier.name} - {self.shipment_date}"

class ShipmentItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name='items', verbose_name="الإرسالية")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, verbose_name="الصنف")
    quantity = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الكمية الواردة")
    unit = models.CharField(max_length=20, verbose_name="الوحدة")
    boxes_count = models.IntegerField(default=0, verbose_name="عدد الفوارغ (العبوات)")
    remaining_qty = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الكمية المتبقية")
    expected_price = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True, verbose_name="السعر المتوقع")

    # ── Module 2: Extra purchase costs (deducted from supplier net) ───────────
    plastic_cost    = models.DecimalField(max_digits=10, decimal_places=3, default=0, verbose_name="تكلفة البلاستيك")
    labor_cost      = models.DecimalField(max_digits=10, decimal_places=3, default=0, verbose_name="عتالة")
    transport_cost  = models.DecimalField(max_digits=10, decimal_places=3, default=0, verbose_name="تكلفة النقل")
    driver_name     = models.CharField(max_length=150, blank=True, null=True, verbose_name="اسم السائق")
    cost_center     = models.CharField(max_length=100, blank=True, null=True, verbose_name="مركز التكلفة")

    @property
    def total_extra_costs(self):
        return self.plastic_cost + self.labor_cost + self.transport_cost

    class Meta:
        verbose_name = 'بند إرسالية'
        verbose_name_plural = 'بنود الإرسالية'

    def __str__(self):
        return f"{self.item.name} x {self.quantity} {self.unit}"
