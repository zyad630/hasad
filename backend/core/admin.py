from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Tenant, CustomUser

@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ('name', 'subdomain', 'status', 'created_at')
    search_fields = ('name', 'subdomain')

@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'tenant', 'role', 'is_active', 'is_staff')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('username',)
