from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import CommissionType, Supplier, Customer
from .serializers import CommissionTypeSerializer, SupplierSerializer, CustomerSerializer
from finance.models import LedgerEntry


# ─── Module 1: CommissionType ViewSet ─────────────────────────────────────────

class CommissionTypeViewSet(viewsets.ModelViewSet):
    """CRUD for commission type master. Used in Supplier dropdown."""
    serializer_class = CommissionTypeSerializer
    filter_backends  = [filters.SearchFilter]
    search_fields    = ['name']

    def get_queryset(self):
        return CommissionType.objects.filter(tenant=self.request.tenant).order_by('name')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)


# ─── Supplier ViewSet ──────────────────────────────────────────────────────────

class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['deal_type', 'is_active']
    search_fields    = ['name', 'phone']
    ordering_fields  = ['name', 'balance']

    def get_queryset(self):
        return Supplier.objects.filter(
            tenant=self.request.tenant
        ).select_related('commission_type').order_by('name')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)

    @action(detail=True, methods=['get'], url_path='account-statement')
    def account_statement(self, request, pk=None):
        supplier = self.get_object()
        tenant   = request.tenant

        entries = LedgerEntry.objects.filter(
            tenant=tenant,
            account_type='supplier',
            account_id=supplier.id,
        ).order_by('-entry_date')

        running = 0
        statement_data = []
        for entry in reversed(list(entries)):
            if entry.entry_type == 'CR':
                running += float(entry.amount)
            else:
                running -= float(entry.amount)
            statement_data.append({
                'date':        entry.entry_date,
                'type':        entry.entry_type,
                'reference':   f"{entry.reference_type} #{entry.reference_id}",
                'description': entry.description,
                'amount':      float(entry.amount),
                'balance':     round(running, 2),
                'currency':    entry.currency_code,
            })

        return Response({
            'supplier_name': supplier.name,
            'phone':         supplier.phone,
            'whatsapp':      supplier.whatsapp_number,
            'commission':    SupplierSerializer(supplier, context={'request': request}).data['commission_rate'],
            'current_balance': round(running, 2),
            'entries':       list(reversed(statement_data)),
        })


# ─── Customer ViewSet ──────────────────────────────────────────────────────────

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['customer_type', 'is_active']
    search_fields    = ['name', 'phone']
    ordering_fields  = ['name', 'credit_balance']

    def get_queryset(self):
        return Customer.objects.filter(
            tenant=self.request.tenant
        ).order_by('-credit_balance', 'name')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)

    @action(detail=True, methods=['get'], url_path='account-statement')
    def account_statement(self, request, pk=None):
        customer = self.get_object()
        tenant   = request.tenant

        entries = LedgerEntry.objects.filter(
            tenant=tenant,
            account_type='customer',
            account_id=customer.id,
        ).order_by('-entry_date')

        running = 0
        statement_data = []
        for entry in reversed(list(entries)):
            if entry.entry_type == 'DR':
                running += float(entry.amount)
            else:
                running -= float(entry.amount)
            statement_data.append({
                'date':        entry.entry_date,
                'type':        entry.entry_type,
                'reference':   f"{entry.reference_type} #{entry.reference_id}",
                'description': entry.description,
                'amount':      float(entry.amount),
                'balance':     round(running, 2),
                'currency':    entry.currency_code,
            })

        return Response({
            'customer_name':   customer.name,
            'phone':           customer.phone,
            'current_balance': round(running, 2),
            'entries':         list(reversed(statement_data)),
        })

    @action(detail=False, methods=['get'], url_path='balance-report')
    def balance_report(self, request):
        tenant    = request.tenant
        customers = self.get_queryset()
        report    = []
        for customer in customers:
            last_cr = LedgerEntry.objects.filter(
                tenant=tenant, account_type='customer', account_id=customer.id, entry_type='CR'
            ).order_by('-entry_date').first()
            last_dr = LedgerEntry.objects.filter(
                tenant=tenant, account_type='customer', account_id=customer.id, entry_type='DR'
            ).order_by('-entry_date').first()
            report.append({
                'id':                customer.id,
                'name':              customer.name,
                'phone':             customer.phone,
                'balances':          CustomerSerializer(customer, context={'request': request}).data['balances'],
                'last_payment_date': last_cr.entry_date if last_cr else None,
                'last_invoice_date': last_dr.entry_date if last_dr else None,
                'notes':             customer.notes,
            })
        return Response(report)
