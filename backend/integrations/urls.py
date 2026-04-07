from django.urls import path
from .views import whatsapp_webhook, send_whatsapp_alert

urlpatterns = [
    path('whatsapp/webhook/', whatsapp_webhook, name='whatsapp_webhook'),
    path('whatsapp/send/', send_whatsapp_alert, name='send_whatsapp_alert'),
]

