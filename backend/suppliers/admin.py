from django.contrib import admin
from .models import CommissionType, Supplier, Customer


@admin.register(CommissionType)
class CommissionTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'tenant', 'calc_type', 'default_rate')
    list_filter = ('calc_type',)
    search_fields = ('name',)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('name', 'tenant', 'deal_type', 'get_commission_display', 'balance', 'is_active')
    list_filter = ('deal_type', 'is_active')
    search_fields = ('name', 'phone')
    autocomplete_fields = ['commission_type']

    @admin.display(description='العمولة')
    def get_commission_display(self, obj):
        if obj.commission_type:
            return f"{obj.commission_type.name} ({obj.commission_type.default_rate})"
        return '—'


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'tenant', 'customer_type', 'credit_balance', 'is_active')
    list_filter = ('customer_type', 'is_active')
    search_fields = ('name', 'phone')
