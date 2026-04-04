from django.contrib import admin
from .models import Supplier, Customer

@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('name', 'tenant', 'deal_type', 'commission_rate', 'balance', 'is_active')
    list_filter = ('deal_type', 'is_active')
    search_fields = ('name', 'phone')

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'tenant', 'customer_type', 'credit_balance', 'is_active')
    list_filter = ('customer_type', 'is_active')
    search_fields = ('name', 'phone')
