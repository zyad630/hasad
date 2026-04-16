from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DailyMovementViewSet, FastTranscriptionView

router = DefaultRouter()
router.register(r'movements', DailyMovementViewSet, basename='movement')

urlpatterns = [
    path('fast-transcription/', FastTranscriptionView.as_view(), name='fast-transcription'),
    path('', include(router.urls)),
]
