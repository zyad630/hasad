from django.db import models
from django.conf import settings
from decimal import Decimal
from core.models import Tenant, Currency
from suppliers.models import Supplier, Customer

from django.utils import timezone

class DailyMovement(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    daily_seq = models.PositiveIntegerField(blank=True, verbose_name="رقم تسلسلي يومي")
    tx_date = models.DateField(default=timezone.now, verbose_name="تاريخ الحركة")
    
    # Supplier Side (المزارع)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='movements', verbose_name="المزارع")
    item_name = models.CharField(max_length=200, verbose_name="الصنف")
    unit = models.CharField(max_length=50, blank=True, null=True, verbose_name="الوحدة")
    count = models.PositiveIntegerField(default=0, verbose_name="العدد")
    gross_weight = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="وزن قائم")
    net_weight = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="وزن صافي")
    
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="سعر الشراء")
    purchase_total = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="إجمالي الشراء")
    
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name="نسبة الكمسيون")
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="مبلغ الكمسيون")
    
    # Buyer Side (المشتري)
    buyer = models.ForeignKey(Customer, on_delete=models.PROTECT, null=True, blank=True, related_name='purchases', verbose_name="المشتري")
    sale_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="كمية البيع")
    sale_price = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="سعر البيع")
    sale_total = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="إجمالي البيع")
    
    box_price = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="ثمن كرتون")
    
    # Financial Side
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT, verbose_name="العملة")
    currency_code = models.CharField(max_length=10, blank=True, null=True, verbose_name="رمز العملة")
    cash_received = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="قبض نقدي")
    check_received = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="قبض شيكات")
    
    # Linked Vouchers
    expense_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="صرف / دفع")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.daily_seq:
            last = DailyMovement.objects.filter(tenant=self.tenant, tx_date=self.tx_date).order_by('-daily_seq').first()
            self.daily_seq = (last.daily_seq + 1) if last else 1
            
        if self.currency:
            self.currency_code = self.currency.code
        
        # Recalculate totals
        self.purchase_total = self.net_weight * Decimal(str(self.purchase_price))
        self.commission_amount = self.purchase_total * (Decimal(str(self.commission_rate)) / 100)
        self.sale_total = (self.sale_qty * Decimal(str(self.sale_price))) + (self.count * Decimal(str(self.box_price)))
        
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-tx_date', 'daily_seq']
        verbose_name = "حركة يومية"
        verbose_name_plural = "الحركات اليومية"

    def __str__(self):
        return f"{self.daily_seq} - {self.supplier.name} - {self.item_name}"
