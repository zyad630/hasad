from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import DailyMovement
from .serializers import DailyMovementSerializer
from .services import DailyMovementService

class DailyMovementViewSet(viewsets.ModelViewSet):
    serializer_class = DailyMovementSerializer

    def get_queryset(self):
        qs = DailyMovement.objects.filter(tenant=self.request.tenant)
        date = self.request.query_params.get('date')
        date_from = self.request.query_params.get('from')
        date_to = self.request.query_params.get('to')
        
        if date:
            qs = qs.filter(tx_date=date)
        if date_from:
            qs = qs.filter(tx_date__gte=date_from)
        if date_to:
            qs = qs.filter(tx_date__lte=date_to)
            
        return qs.order_by('-tx_date', 'daily_seq')

    def perform_create(self, serializer):
        checks_details = serializer.validated_data.pop('checks_details', [])
        movement = serializer.save(tenant=self.request.tenant)
        # Handle financial automation
        DailyMovementService.process_movement(movement, checks_details=checks_details)
