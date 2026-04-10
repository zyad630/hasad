from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Core
from core.views import (
    LoginView, MeView, ChangePasswordView, TenantViewSet, 
    RegisterTenantView, UserViewSet, CurrencyViewSet, CurrencyExchangeRateViewSet
)
from core import api_superadmin
# Suppliers
from suppliers.views import CommissionTypeViewSet, SupplierViewSet, CustomerViewSet
# Inventory
from inventory.views import CategoryViewSet, ItemViewSet, ShipmentViewSet
# Sales
from sales.views import SaleViewSet, ContainerTransactionViewSet
# Finance
from finance.views import (
    SettlementViewSet, ExpenseViewSet, CashTransactionViewSet,
    AccountGroupViewSet, AccountViewSet
)
# Market
from market.views import DailyMovementViewSet
# Modules 3-7
from market.extra_views import (
    ItemUnitViewSet, SalesOrderViewSet, PurchaseOrderViewSet,
    SaleReturnViewSet, PurchaseReturnViewSet,
    EmployeeViewSet, PayrollRunViewSet,
    AdvancedCheckViewSet,
)
# Reports
from reports.views import DashboardView, SalesReportView, AgingReportView, UnifiedStatementView, ReceivablesPayablesView, SalesInvoicesListView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'tenants', TenantViewSet, basename='tenant')
router.register(r'currencies', CurrencyViewSet, basename='currency')
router.register(r'exchange-rates', CurrencyExchangeRateViewSet, basename='exchange_rate')
# Module 1
router.register(r'commission-types', CommissionTypeViewSet, basename='commission_type')
# Suppliers & Customers
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'customers', CustomerViewSet, basename='customer')
# Inventory
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'items', ItemViewSet, basename='item')
# Module 3 — Multi-Unit
router.register(r'item-units', ItemUnitViewSet, basename='item_unit')
router.register(r'shipments', ShipmentViewSet, basename='shipment')
# Sales
router.register(r'sales', SaleViewSet, basename='sale')
router.register(r'containers', ContainerTransactionViewSet, basename='container')
# Module 4 — Orders
router.register(r'sales-orders', SalesOrderViewSet, basename='sales_order')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase_order')
# Module 5 — Returns
router.register(r'sale-returns', SaleReturnViewSet, basename='sale_return')
router.register(r'purchase-returns', PurchaseReturnViewSet, basename='purchase_return')
# Finance
router.register(r'settlements', SettlementViewSet, basename='settlement')
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'cash-transactions', CashTransactionViewSet, basename='cash_transaction')
router.register(r'account-groups', AccountGroupViewSet, basename='account_group')
router.register(r'accounts', AccountViewSet, basename='account')
# Module 6 — HR & Payroll
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'payroll-runs', PayrollRunViewSet, basename='payroll_run')
# Module 7 — Advanced Checks
router.register(r'checks', AdvancedCheckViewSet, basename='check')
# Market
router.register(r'market/movements', DailyMovementViewSet, basename='market_movement')


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
    path('api/reports/unified-statement/', UnifiedStatementView.as_view(), name='unified_statement'),
    path('api/reports/receivables/', ReceivablesPayablesView.as_view(), name='receivables_payables'),
    path('api/reports/invoices/', SalesInvoicesListView.as_view(), name='invoices_report'),

    # API
    path('api/', include(router.urls)),
    path('api/integrations/', include('integrations.urls')),
    
    # Super Admin Dashboard Endpoints
    path('api/superadmin/overview/', api_superadmin.overview, name='superadmin_overview'),
    path('api/superadmin/tenants/', api_superadmin.list_tenants, name='superadmin_tenants'),
    path('api/superadmin/tenants/<uuid:tenant_id>/activity/', api_superadmin.tenant_activity, name='superadmin_tenant_activity'),
    path('api/superadmin/audit-log/', api_superadmin.list_audit_logs, name='superadmin_audit_logs'),

    # Docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
