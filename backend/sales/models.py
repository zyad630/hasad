import uuid
from django.db import models
from django.core.exceptions import PermissionDenied
from core.models import Tenant, CustomUser
from suppliers.models import Customer
from inventory.models import ShipmentItem


class PaymentType(models.TextChoices):
    CASH = 'cash', 'نقدي'
    CREDIT = 'credit', 'آجل (ذمة)'


class Sale(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant       = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    customer     = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="الزبون / تاجر")
    created_by   = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_sales', verbose_name="بواسطة")
    sale_date    = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ البيع")
    payment_type = models.CharField(max_length=10, choices=PaymentType.choices, default=PaymentType.CASH, verbose_name="طريقة الدفع")
    currency_code = models.CharField(max_length=10, default='ILS', verbose_name="العملة")
    exchange_rate  = models.DecimalField(max_digits=18, decimal_places=6, default=1, verbose_name="سعر الصرف")
    foreign_amount = models.DecimalField(max_digits=18, decimal_places=3, default=0, verbose_name="إجمالي الفاتورة (أجنبي)")
    base_amount    = models.DecimalField(max_digits=18, decimal_places=3, default=0, verbose_name="إجمالي الفاتورة (أساسي)")
    # H-01: Cancellation — immutable record, never hard-delete
    is_cancelled  = models.BooleanField(default=False, db_index=True, verbose_name="ملغاة؟")
    cancelled_at  = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الإلغاء")
    cancelled_by  = models.ForeignKey(
        CustomUser, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='cancelled_sales', verbose_name="ملغاة بواسطة"
    )
    cancel_reason = models.TextField(blank=True, verbose_name="سبب الإلغاء")

    def delete(self, *args, **kwargs):
        raise PermissionDenied(
            'فواتير البيع لا يمكن حذفها. استخدم الإلغاء مع ذكر السبب.'
        )

    def __str__(self):
        return f"فاتورة بيع {self.id} - {self.total_amount}"

    class Meta:
        verbose_name = 'فاتورة بيع'
        verbose_name_plural = 'فواتير البيع'
        indexes = [
            models.Index(fields=['tenant', 'sale_date']),
            models.Index(fields=['tenant', 'payment_type']),
            models.Index(fields=['tenant', 'is_cancelled']),
        ]


class SaleItem(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale           = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items', verbose_name="الفاتورة")
    shipment_item  = models.ForeignKey(ShipmentItem, on_delete=models.PROTECT, verbose_name="بند الإرسالية")
    quantity       = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الكمية المباعة")
    unit_price     = models.DecimalField(max_digits=10, decimal_places=3, verbose_name="سعر الوحدة")
    subtotal       = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الإجمالي الفرعي")
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name="نسبة العمولة (%)")
    discount       = models.DecimalField(max_digits=10, decimal_places=3, default=0, verbose_name="خصم الصنف")
    gross_weight   = models.DecimalField(max_digits=12, decimal_places=3, default=0, verbose_name="الوزن القائم")
    net_weight     = models.DecimalField(max_digits=12, decimal_places=3, default=0, verbose_name="الوزن الصافي")
    containers_out = models.IntegerField(default=0, verbose_name="الفوارغ الصادرة")

    class Meta:
        verbose_name = 'بند فاتورة'
        verbose_name_plural = 'بنود الفاتورة'
        indexes = [
            models.Index(fields=['shipment_item']),
        ]

    def __str__(self):
        return f"{self.quantity} x {self.unit_price}"


class ContainerDirection(models.TextChoices):
    OUT    = 'out', 'صرف (إلى الزبون)'
    RETURN = 'return', 'استلام (مُرتجع من الزبون)'


class ContainerTransaction(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant         = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    customer       = models.ForeignKey(Customer, on_delete=models.CASCADE, verbose_name="الزبون / تاجر")
    sale           = models.ForeignKey(Sale, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="مرتبط بفاتورة")
    container_type = models.CharField(max_length=100, verbose_name="نوع الفارغ")
    direction      = models.CharField(max_length=10, choices=ContainerDirection.choices, verbose_name="اتجاه الحركة")
    quantity       = models.IntegerField(verbose_name="الكمية")
    tx_date        = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الحركة")

    class Meta:
        verbose_name = 'حركة فوارغ'
        verbose_name_plural = 'حركات الفوارغ'

    def __str__(self):
        return f"{self.direction} {self.quantity} {self.container_type}"


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
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant         = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    customer       = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="الزبون")
    order_date     = models.DateField(auto_now_add=True, verbose_name="تاريخ الطلب")
    status         = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING, verbose_name="الحالة")
    notes          = models.TextField(blank=True, null=True)
    converted_sale = models.OneToOneField(Sale, on_delete=models.SET_NULL, null=True, blank=True,
                                          related_name='source_order', verbose_name="الفاتورة المحولة")
    created_by     = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="بواسطة")
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'طلب بيع'
        verbose_name_plural = 'طلبات البيع'
        indexes = [models.Index(fields=['tenant', 'status', 'order_date'])]

    def __str__(self):
        return f"طلب بيع #{self.id} — {getattr(self.customer, 'name', '—')}"


class SalesOrderItem(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order      = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name='items')
    item       = models.ForeignKey('inventory.Item', on_delete=models.PROTECT, verbose_name="الصنف")
    unit_name  = models.CharField(max_length=50, default='kg', verbose_name="الوحدة")
    quantity   = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الكمية")
    unit_price = models.DecimalField(max_digits=10, decimal_places=3, verbose_name="السعر")
    subtotal   = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الإجمالي الفرعي")

    class Meta:
        verbose_name = 'بند طلب بيع'
        verbose_name_plural = 'بنود طلبات البيع'


class PurchaseOrder(models.Model):
    from suppliers.models import Supplier
    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant             = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    supplier           = models.ForeignKey('suppliers.Supplier', on_delete=models.SET_NULL, null=True, blank=True, verbose_name="المورد / المزارع")
    order_date         = models.DateField(auto_now_add=True, verbose_name="تاريخ الطلب")
    status             = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING, verbose_name="الحالة")
    notes              = models.TextField(blank=True, null=True)
    converted_shipment = models.OneToOneField('inventory.Shipment', on_delete=models.SET_NULL,
                                              null=True, blank=True, related_name='source_order',
                                              verbose_name="الإرسالية المحولة")
    created_by         = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="بواسطة")
    created_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'أمر شراء'
        verbose_name_plural = 'أوامر الشراء'
        indexes = [models.Index(fields=['tenant', 'status'])]

    def __str__(self):
        return f"أمر شراء #{self.id} — {getattr(self.supplier, 'name', '—')}"


class PurchaseOrderItem(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order      = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    item       = models.ForeignKey('inventory.Item', on_delete=models.PROTECT, verbose_name="الصنف")
    unit_name  = models.CharField(max_length=50, default='kg', verbose_name="الوحدة")
    quantity   = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الكمية")
    unit_price = models.DecimalField(max_digits=10, decimal_places=3, verbose_name="السعر")
    subtotal   = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الإجمالي الفرعي")

    class Meta:
        verbose_name = 'بند أمر شراء'
        verbose_name_plural = 'بنود أوامر الشراء'


# ═══════════════════════════════════════════════════════════════════════════════
# Module 5 — Sales Return & Purchase Return (immutable, never modify original)
# ═══════════════════════════════════════════════════════════════════════════════

class ReturnReason(models.TextChoices):
    DEFECTIVE  = 'defective',  'بضاعة تالفة'
    WRONG_ITEM = 'wrong_item', 'صنف خاطئ'
    EXCESS     = 'excess',     'كمية زائدة'
    OTHER      = 'other',      'أخرى'


class SaleReturn(models.Model):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant        = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    original_sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name='returns', verbose_name="الفاتورة الأصلية")
    return_date   = models.DateTimeField(auto_now_add=True)
    reason        = models.CharField(max_length=20, choices=ReturnReason.choices, default=ReturnReason.OTHER, verbose_name="سبب الإرجاع")
    notes         = models.TextField(blank=True, null=True)
    return_amount = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="قيمة المرتجع")
    created_by    = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="بواسطة")

    def delete(self, *args, **kwargs):
        raise PermissionDenied('سجلات المرتجعات لا يمكن حذفها')

    class Meta:
        verbose_name = 'مرتجع مبيعات'
        verbose_name_plural = 'مرتجعات المبيعات'

    def __str__(self):
        return f"مرتجع فاتورة #{self.original_sale_id}"


class SaleReturnItem(models.Model):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale_return   = models.ForeignKey(SaleReturn, on_delete=models.CASCADE, related_name='items')
    shipment_item = models.ForeignKey('inventory.ShipmentItem', on_delete=models.PROTECT, verbose_name="بند الإرسالية")
    quantity      = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الكمية المرتجعة")
    unit_price    = models.DecimalField(max_digits=10, decimal_places=3, verbose_name="السعر")
    subtotal      = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الإجمالي")

    class Meta:
        verbose_name = 'بند مرتجع مبيعات'
        verbose_name_plural = 'بنود مرتجعات المبيعات'


class PurchaseReturn(models.Model):
    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant            = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    original_shipment = models.ForeignKey('inventory.Shipment', on_delete=models.PROTECT,
                                          related_name='returns', verbose_name="الإرسالية الأصلية")
    return_date       = models.DateTimeField(auto_now_add=True)
    reason            = models.CharField(max_length=20, choices=ReturnReason.choices, default=ReturnReason.OTHER, verbose_name="سبب الإرجاع")
    notes             = models.TextField(blank=True, null=True)
    return_amount     = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="قيمة المرتجع")
    created_by        = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="بواسطة")

    def delete(self, *args, **kwargs):
        raise PermissionDenied('سجلات المرتجعات لا يمكن حذفها')

    class Meta:
        verbose_name = 'مرتجع مشتريات'
        verbose_name_plural = 'مرتجعات المشتريات'

    def __str__(self):
        return f"مرتجع إرسالية #{self.original_shipment_id}"


class PurchaseReturnItem(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase_return = models.ForeignKey(PurchaseReturn, on_delete=models.CASCADE, related_name='items')
    shipment_item   = models.ForeignKey('inventory.ShipmentItem', on_delete=models.PROTECT, verbose_name="بند الإرسالية")
    quantity        = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الكمية المرتجعة")
    unit_price      = models.DecimalField(max_digits=10, decimal_places=3, verbose_name="السعر")
    subtotal        = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="الإجمالي")

    class Meta:
        verbose_name = 'بند مرتجع مشتريات'
        verbose_name_plural = 'بنود مرتجعات المشتريات'
