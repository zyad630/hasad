import uuid
from django.db import models
from core.models import Tenant
from suppliers.models import Supplier
from inventory.models import Shipment

class Settlement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    shipment = models.OneToOneField(Shipment, on_delete=models.PROTECT, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)
    total_sales = models.DecimalField(max_digits=12, decimal_places=2)
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2)
    total_expenses = models.DecimalField(max_digits=12, decimal_places=2)
    net_supplier = models.DecimalField(max_digits=12, decimal_places=2)
    is_paid = models.BooleanField(default=False)
    settled_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Settlement for {self.shipment}"

class ExpenseType(models.TextChoices):
    TRANSPORT = 'transport', 'Transport'
    LOADING = 'loading', 'Loading'
    LABOR = 'labor', 'Labor'
    MISC = 'misc', 'Misc'

class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    shipment = models.ForeignKey(Shipment, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')
    expense_type = models.CharField(max_length=20, choices=ExpenseType.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True, null=True)
    expense_date = models.DateField()

    def __str__(self):
        return f"{self.expense_type} - {self.amount}"

class CashTxType(models.TextChoices):
    IN = 'in', 'In'
    OUT = 'out', 'Out'

class CashTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    tx_type = models.CharField(max_length=5, choices=CashTxType.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference_type = models.CharField(max_length=50, blank=True, null=True)  # sale/settlement/expense/manual
    reference_id = models.UUIDField(null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    tx_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.tx_type} {self.amount}"

from django.db.models import Sum, Q
from decimal import Decimal, ROUND_HALF_UP

class LedgerEntry(models.Model):
    DEBIT  = 'DR'
    CREDIT = 'CR'

    tenant       = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    entry_date   = models.DateTimeField(auto_now_add=True)
    entry_type   = models.CharField(max_length=2, choices=[(DEBIT,'Debit'),(CREDIT,'Credit')])
    account_type = models.CharField(max_length=30)
    account_id   = models.UUIDField()
    amount       = models.DecimalField(max_digits=18, decimal_places=2)
    reference_type = models.CharField(max_length=50)
    reference_id   = models.UUIDField()
    description    = models.CharField(max_length=500)
    created_by     = models.ForeignKey('core.CustomUser', on_delete=models.SET_NULL, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['tenant', 'account_type', 'account_id']),
            models.Index(fields=['reference_type', 'reference_id']),
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            raise PermissionError("Ledger entries are immutable — use reversal entries")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("Ledger entries cannot be deleted — financial records are permanent")

    @classmethod
    def get_balance(cls, tenant, account_type, account_id):
        result = cls.objects.filter(
            tenant=tenant,
            account_type=account_type,
            account_id=account_id,
        ).aggregate(
            total_dr=Sum('amount', filter=Q(entry_type=cls.DEBIT)),
            total_cr=Sum('amount', filter=Q(entry_type=cls.CREDIT)),
        )
        dr = result['total_dr'] or Decimal('0')
        cr = result['total_cr'] or Decimal('0')
        return (dr - cr).quantize(Decimal('0.01'), ROUND_HALF_UP)
