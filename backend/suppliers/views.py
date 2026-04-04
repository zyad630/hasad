from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Supplier, Customer
from .serializers import SupplierSerializer, CustomerSerializer


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class  = SupplierSerializer
    filter_backends   = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields  = ['deal_type', 'is_active']
    search_fields     = ['name', 'phone']
    ordering_fields   = ['name', 'balance']

    def get_queryset(self):
        return Supplier.objects.filter(
            tenant=self.request.user.tenant
        ).prefetch_related(
            'shipment_set',         # pre-load shipments list if serialized
        ).order_by('name')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class  = CustomerSerializer
    filter_backends   = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields  = ['customer_type', 'is_active']
    search_fields     = ['name', 'phone']
    ordering_fields   = ['name', 'credit_balance']

    def get_queryset(self):
        return Customer.objects.filter(
            tenant=self.request.user.tenant
        ).order_by('-credit_balance', 'name')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)
