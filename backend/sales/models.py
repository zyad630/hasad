import uuid
from django.db import models
from django.core.exceptions import PermissionDenied
from core.models import Tenant, CustomUser
from suppliers.models import Customer
from inventory.models import ShipmentItem


class PaymentType(models.TextChoices):
    CASH = 'cash', 'Cash'
    CREDIT = 'credit', 'Credit'


class Sale(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant       = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    customer     = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True)
    created_by   = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_sales')
    sale_date    = models.DateTimeField(auto_now_add=True)
    payment_type = models.CharField(max_length=10, choices=PaymentType.choices, default=PaymentType.CASH)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # H-01: Cancellation — immutable record, never hard-delete
    is_cancelled  = models.BooleanField(default=False, db_index=True)
    cancelled_at  = models.DateTimeField(null=True, blank=True)
    cancelled_by  = models.ForeignKey(
        CustomUser, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='cancelled_sales'
    )
    cancel_reason = models.TextField(blank=True)

    def delete(self, *args, **kwargs):
        raise PermissionDenied(
            'فواتير البيع لا يمكن حذفها. استخدم الإلغاء مع ذكر السبب.'
        )

    def __str__(self):
        return f"Sale {self.id} - {self.total_amount}"

    class Meta:
        indexes = [
            models.Index(fields=['tenant', 'sale_date']),
            models.Index(fields=['tenant', 'payment_type']),
            models.Index(fields=['tenant', 'is_cancelled']),
        ]


class SaleItem(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale           = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    shipment_item  = models.ForeignKey(ShipmentItem, on_delete=models.PROTECT)
    quantity       = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price     = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal       = models.DecimalField(max_digits=12, decimal_places=2)
    containers_out = models.IntegerField(default=0)

    def __str__(self):
        return f"SaleItem {self.id} - {self.quantity} units"

    class Meta:
        indexes = [
            models.Index(fields=['shipment_item']),
        ]


class ContainerDirection(models.TextChoices):
    OUT    = 'out', 'Out'
    RETURN = 'return', 'Return'


class ContainerTransaction(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant         = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    customer       = models.ForeignKey(Customer, on_delete=models.CASCADE)
    sale           = models.ForeignKey(Sale, on_delete=models.SET_NULL, null=True, blank=True)
    container_type = models.CharField(max_length=100)
    direction      = models.CharField(max_length=10, choices=ContainerDirection.choices)
    quantity       = models.IntegerField()
    tx_date        = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.direction} {self.quantity} {self.container_type}"
