import uuid
from django.db import models
from core.models import Tenant
from suppliers.models import Supplier, DealType

class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class BaseUnit(models.TextChoices):
    KG = 'kg', 'Kilogram'
    BOX = 'box', 'Box'
    SACK = 'sack', 'Sack'
    BUNCH = 'bunch', 'Bunch'

class Item(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=200)
    base_unit = models.CharField(max_length=10, choices=BaseUnit.choices, default=BaseUnit.KG)
    waste_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class UnitConversion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='conversions')
    from_unit = models.CharField(max_length=20)
    to_unit = models.CharField(max_length=20)
    factor = models.DecimalField(max_digits=10, decimal_places=4)

    def __str__(self):
        return f"1 {self.from_unit} = {self.factor} {self.to_unit} of {self.item.name}"

class ShipmentStatus(models.TextChoices):
    OPEN = 'open', 'Open'
    SETTLED = 'settled', 'Settled'

class Shipment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)
    shipment_date = models.DateField()
    deal_type = models.CharField(max_length=20, choices=DealType.choices, default=DealType.COMMISSION)
    status = models.CharField(max_length=20, choices=ShipmentStatus.choices, default=ShipmentStatus.OPEN)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Shipment {self.id} - {self.supplier.name} on {self.shipment_date}"

class ShipmentItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit = models.CharField(max_length=20)
    boxes_count = models.IntegerField(default=0)
    remaining_qty = models.DecimalField(max_digits=12, decimal_places=3)
    expected_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    def __str__(self):
        return f"{self.quantity} {self.unit} of {self.item.name}"
