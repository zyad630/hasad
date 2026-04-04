import uuid
from django.db import models
from core.models import Tenant

class DealType(models.TextChoices):
    COMMISSION = 'commission', 'Commission'
    DIRECT_PURCHASE = 'direct_purchase', 'Direct Purchase'

class CommissionType(models.TextChoices):
    PERCENT = 'percent', 'Percent'
    FIXED = 'fixed', 'Fixed'

class Supplier(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20, null=True, blank=True)
    deal_type = models.CharField(max_length=20, choices=DealType.choices, default=DealType.COMMISSION)
    commission_type = models.CharField(max_length=20, choices=CommissionType.choices, default=CommissionType.PERCENT)
    commission_rate = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    whatsapp_number = models.CharField(max_length=20, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class CustomerType(models.TextChoices):
    TRADER = 'trader', 'Trader'
    RETAIL = 'retail', 'Retail'
    INDIVIDUAL = 'individual', 'Individual'

class Customer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20, null=True, blank=True)
    customer_type = models.CharField(max_length=20, choices=CustomerType.choices, default=CustomerType.TRADER)
    credit_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name
