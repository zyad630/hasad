from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import WhatsAppMessage, AIAlert


class WhatsAppMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppMessage
        fields = '__all__'


class AIAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAlert
        fields = '__all__'


class WhatsAppMessageViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WhatsAppMessageSerializer

    def get_queryset(self):
        return WhatsAppMessage.objects.filter(tenant=self.request.tenant)
    
    @action(detail=False, methods=['post'], url_path='send')
    def send_message(self, request):
        phone = request.data.get('phone')
        message = request.data.get('message')
        
        if not phone or not message:
            return Response({'error': 'رقم الهاتف والرسالة مطلوبان'}, status=status.HTTP_400_BAD_REQUEST)
            
        from .services import WhatsAppService
        response = WhatsAppService.send_message(phone, message)
        
        if response.status_code == 200:
            # Optionally save to WhatsAppMessage model
            WhatsAppMessage.objects.create(
                tenant=request.tenant,
                recipient_phone=phone,
                message_body=message,
                status='sent'
            )
            return Response({'status': 'تم إرسال الرسالة بنجاح'})
        return Response({'error': 'فشل إرسال الرسالة', 'details': getattr(response, 'text', '')}, status=status.HTTP_400_BAD_REQUEST)


class AIAlertViewSet(viewsets.ModelViewSet):
    serializer_class = AIAlertSerializer

    def get_queryset(self):
        return AIAlert.objects.filter(tenant=self.request.tenant).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)
