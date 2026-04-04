from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Core
from core.views import LoginView, MeView, ChangePasswordView, TenantViewSet, RegisterTenantView, UserViewSet
from core import api_superadmin
# Suppliers
from suppliers.views import SupplierViewSet, CustomerViewSet
# Inventory
from inventory.views import CategoryViewSet, ItemViewSet, ShipmentViewSet
# Sales
from sales.views import SaleViewSet, ContainerTransactionViewSet
# Finance
from finance.views import SettlementViewSet, ExpenseViewSet, CashTransactionViewSet
# Integrations
from integrations.views import WhatsAppMessageViewSet, AIAlertViewSet
# Reports
from reports.views import DashboardView, SalesReportView, AgingReportView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'tenants', TenantViewSet, basename='tenant')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'items', ItemViewSet, basename='item')
router.register(r'shipments', ShipmentViewSet, basename='shipment')
router.register(r'sales', SaleViewSet, basename='sale')
router.register(r'containers', ContainerTransactionViewSet, basename='container')
router.register(r'settlements', SettlementViewSet, basename='settlement')
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'cash-transactions', CashTransactionViewSet, basename='cash_transaction')
router.register(r'whatsapp-messages', WhatsAppMessageViewSet, basename='whatsapp_message')
router.register(r'ai-alerts', AIAlertViewSet, basename='ai_alert')

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Auth
    path('api/auth/login/', LoginView.as_view(), name='auth_login'),
    path('api/auth/me/', MeView.as_view(), name='auth_me'),
    path('api/auth/change-password/', ChangePasswordView.as_view(), name='auth_change_password'),
    path('api/auth/register-tenant/', RegisterTenantView.as_view(), name='auth_register_tenant'),

    # Reports
    path('api/reports/dashboard/', DashboardView.as_view(), name='reports_dashboard'),
    path('api/reports/sales/', SalesReportView.as_view(), name='reports_sales'),
    path('api/reports/aging/', AgingReportView.as_view(), name='reports_aging'),

    # API
    path('api/', include(router.urls)),
    
    # Super Admin Dashboard Endpoints
    path('api/superadmin/overview/', api_superadmin.overview, name='superadmin_overview'),
    path('api/superadmin/tenants/', api_superadmin.list_tenants, name='superadmin_tenants'),
    path('api/superadmin/tenants/<uuid:tenant_id>/activity/', api_superadmin.tenant_activity, name='superadmin_tenant_activity'),
    path('api/superadmin/audit-log/', api_superadmin.list_audit_logs, name='superadmin_audit_logs'),

    # Docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
