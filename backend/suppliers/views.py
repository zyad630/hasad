from rest_framework import viewsets, filters, status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal

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
        )

        from_date = request.query_params.get('from')
        to_date   = request.query_params.get('to')
        if from_date:
            entries = entries.filter(entry_date__date__gte=from_date)
        if to_date:
            entries = entries.filter(entry_date__date__lte=to_date)

        entries = entries.order_by('-entry_date')

        running_base = Decimal('0')
        statement_data = []
        for entry in reversed(list(entries)):
            if entry.entry_type == 'CR':
                running_base += entry.base_amount
            else:
                running_base -= entry.base_amount
            statement_data.append({
                'date':           entry.entry_date,
                'type':           entry.entry_type,
                'reference':      f"{entry.reference_type} #{entry.reference_id}",
                'description':    entry.description,
                'currency':       entry.currency_code,
                'exchange_rate':  float(entry.exchange_rate),
                'foreign_amount': float(entry.foreign_amount),
                'base_amount':    float(entry.base_amount),
                'balance_base':   float(running_base.quantize(Decimal('0.001'))),
            })

        supplier_data = SupplierSerializer(supplier, context={'request': request}).data
        return Response({
            'supplier_name':     supplier.name,
            'phone':             supplier.phone,
            'whatsapp':          supplier.whatsapp_number,
            'commission':        supplier_data['commission_rate'],
            'current_balances':  supplier_data['balances'],
            'current_balance_ils': float(running_base.quantize(Decimal('0.001'))),
            'entries':           list(reversed(statement_data)),
        })


# ─── Customer ViewSet ──────────────────────────────────────────────────────────

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    pagination_class = None
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['customer_type', 'is_active']
    search_fields    = ['name', 'phone']
    ordering_fields  = ['name', 'credit_balance']

    def get_queryset(self):
        return Customer.objects.filter(
            tenant=self.request.tenant
        ).order_by('name')

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
        )

        from_date = request.query_params.get('from')
        to_date   = request.query_params.get('to')
        if from_date:
            entries = entries.filter(entry_date__date__gte=from_date)
        if to_date:
            entries = entries.filter(entry_date__date__lte=to_date)

        entries = entries.order_by('-entry_date')

        running_base = Decimal('0')
        statement_data = []
        for entry in reversed(list(entries)):
            if entry.entry_type == 'DR':
                running_base += entry.base_amount
            else:
                running_base -= entry.base_amount
            statement_data.append({
                'date':           entry.entry_date,
                'type':           entry.entry_type,
                'reference':      f"{entry.reference_type} #{entry.reference_id}",
                'description':    entry.description,
                'currency':       entry.currency_code,
                'exchange_rate':  float(entry.exchange_rate),
                'foreign_amount': float(entry.foreign_amount),
                'base_amount':    float(entry.base_amount),
                'balance_base':   float(running_base.quantize(Decimal('0.001'))),
            })

        customer_data = CustomerSerializer(customer, context={'request': request}).data
        return Response({
            'customer_name':       customer.name,
            'phone':               customer.phone,
            'current_balances':    customer_data['balances'],
            'current_balance_ils': float(running_base.quantize(Decimal('0.001'))),
            'entries':             list(reversed(statement_data)),
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
