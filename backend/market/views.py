from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import DailyMovement
from .serializers import DailyMovementSerializer
from .services import DailyMovementService

class DailyMovementViewSet(viewsets.ModelViewSet):
    serializer_class = DailyMovementSerializer

    def get_queryset(self):
        return DailyMovement.objects.filter(tenant=self.request.tenant)

    def perform_create(self, serializer):
        checks_details = serializer.validated_data.pop('checks_details', [])
        movement = serializer.save(tenant=self.request.tenant)
        # Handle financial automation
        DailyMovementService.process_movement(movement, checks_details=checks_details)
