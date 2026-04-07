"""
Module 6: Employee & Payroll models
"""
import uuid
from decimal import Decimal
from django.db import models
from core.models import Tenant, CustomUser


class EmployeeStatus(models.TextChoices):
    ACTIVE     = 'active',     'نشط'
    ON_LEAVE   = 'on_leave',   'إجازة'
    TERMINATED = 'terminated', 'منتهي الخدمة'


class Employee(models.Model):
    id                     = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant                 = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name                   = models.CharField(max_length=200, verbose_name="اسم الموظف")
    national_id            = models.CharField(max_length=50, blank=True, null=True, verbose_name="رقم الهوية")
    phone                  = models.CharField(max_length=20, blank=True, null=True, verbose_name="رقم الهاتف")
    job_title              = models.CharField(max_length=100, blank=True, null=True, verbose_name="المسمى الوظيفي")
    basic_salary           = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="الراتب الأساسي")
    working_days_per_month = models.IntegerField(default=26, verbose_name="أيام العمل الشهرية")
    hire_date              = models.DateField(verbose_name="تاريخ التعيين")
    status                 = models.CharField(
        max_length=20, choices=EmployeeStatus.choices,
        default=EmployeeStatus.ACTIVE, verbose_name="الحالة"
    )
    notes                  = models.TextField(blank=True, null=True, verbose_name="ملاحظات")

    class Meta:
        verbose_name = 'موظف'
        verbose_name_plural = 'الموظفون'
        indexes = [models.Index(fields=['tenant', 'status'])]

    def __str__(self):
        return self.name

    def daily_rate(self) -> Decimal:
        """Wage per day = basic_salary / working_days_per_month."""
        if self.working_days_per_month:
            return Decimal(str(self.basic_salary)) / Decimal(str(self.working_days_per_month))
        return Decimal('0')


class PayrollRun(models.Model):
    """A single payroll processing run for a pay period."""
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant     = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    run_date   = models.DateField(verbose_name="تاريخ الصرف")
    period     = models.CharField(max_length=20, verbose_name="الفترة (مثلاً: 2026-04)")
    is_posted  = models.BooleanField(default=False, verbose_name="تم الترحيل المحاسبي؟")
    notes      = models.TextField(blank=True, null=True, verbose_name="ملاحظات")
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="بواسطة")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'تشغيل رواتب'
        verbose_name_plural = 'تشغيلات الرواتب'
        unique_together = [('tenant', 'period')]

    def __str__(self):
        return f"رواتب {self.period}"

    def total_net(self) -> Decimal:
        return sum(line.net_salary for line in self.lines.all())


class PayrollLine(models.Model):
    """One salary line per employee per PayrollRun."""
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payroll_run   = models.ForeignKey(PayrollRun, on_delete=models.CASCADE, related_name='lines')
    employee      = models.ForeignKey(Employee, on_delete=models.PROTECT, verbose_name="الموظف")
    days_worked   = models.IntegerField(verbose_name="أيام العمل الفعلية")
    basic_salary  = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="الراتب الأساسي")
    deductions    = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="الاستقطاعات")
    bonuses       = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="المكافآت")
    net_salary    = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="صافي الراتب")
    ledger_posted = models.BooleanField(default=False, verbose_name="تم الترحيل؟")

    class Meta:
        verbose_name = 'بند راتب'
        verbose_name_plural = 'بنود الرواتب'

    def __str__(self):
        return f"{self.employee.name} — {self.net_salary}"

    def calculate_net(self):
        """Auto-calculate net salary based on days worked."""
        daily = self.employee.daily_rate()
        earned = daily * Decimal(str(self.days_worked))
        return (earned + self.bonuses - self.deductions).quantize(Decimal('0.01'))
