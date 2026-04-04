from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Category, Item, UnitConversion, Shipment, ShipmentItem
from .serializers import CategorySerializer, ItemSerializer, ShipmentSerializer, ShipmentItemSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer

    def get_queryset(self):
        return Category.objects.filter(tenant=self.request.user.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class ItemViewSet(viewsets.ModelViewSet):
    serializer_class  = ItemSerializer
    filter_backends   = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields  = ['category', 'is_active', 'base_unit']
    search_fields     = ['name']

    def get_queryset(self):
        return Item.objects.filter(
            tenant=self.request.user.tenant
        ).select_related(
            'category',
        ).prefetch_related(
            'conversions',
        )

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class ShipmentViewSet(viewsets.ModelViewSet):
    serializer_class  = ShipmentSerializer
    filter_backends   = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields  = ['supplier', 'status', 'deal_type', 'shipment_date']
    ordering_fields   = ['shipment_date', 'created_at']

    def get_queryset(self):
        return Shipment.objects.filter(
            tenant=self.request.user.tenant
        ).select_related(
            'supplier',
        ).prefetch_related(
            'items',
            'items__item',
            'expenses',
        ).order_by('-shipment_date')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['tenant'] = self.request.user.tenant
        return ctx


class ShipmentItemViewSet(viewsets.ModelViewSet):
    serializer_class = ShipmentItemSerializer

    def get_queryset(self):
        return ShipmentItem.objects.filter(
            shipment__tenant=self.request.user.tenant
        ).select_related('shipment', 'item')

    def perform_create(self, serializer):
        serializer.save()
