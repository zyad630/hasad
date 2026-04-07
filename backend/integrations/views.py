from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from .whatsapp_bot import WhatsAppBotService


@csrf_exempt
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def whatsapp_webhook(request):
    """
    Webhook handler for Meta Cloud API (WhatsApp).
    Handles verification (GET) and incoming messages (POST).
    """

    # 1. VERIFICATION (GET)
    if request.method == 'GET':
        mode = request.GET.get('hub.mode')
        challenge = request.GET.get('hub.challenge')
        if mode == 'subscribe':
            return HttpResponse(challenge)
        return HttpResponse('Invalid verification', status=403)

    # 2. INCOMING MESSAGES (POST)
    if request.method == 'POST':
        try:
            data = request.data

            # Navigate nested structure: entry -> changes -> value -> messages
            entries = data.get('entry', [])
            if not entries:
                return JsonResponse({'status': 'ok'})

            value = entries[0].get('changes', [{}])[0].get('value', {})
            messages = value.get('messages', [])

            if messages:
                message = messages[0]
                sender_phone = message.get('from', '')
                text = message.get('text', {}).get('body', '')

                if text and sender_phone:
                    reply_text = WhatsAppBotService.handle_message(sender_phone, text)
                    WhatsAppBotService.send_message(sender_phone, reply_text)

            return JsonResponse({'status': 'ok'})
        except Exception as e:
            print(f"WhatsApp Webhook Error: {str(e)}")
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

    return JsonResponse({'status': 'method_not_allowed'}, status=405)


@api_view(['POST'])
def send_whatsapp_alert(request):
    """
    Endpoint for frontend to send a manual WhatsApp message (Invoice, Statement).
    """
    phone = request.data.get('phone', '').strip()
    text = request.data.get('text', '').strip()

    if not phone or not text:
        return JsonResponse({'error': 'phone and text are required'}, status=400)

    success = WhatsAppBotService.send_message(phone, text)
    if success:
        return JsonResponse({'status': 'Message sent successfully.'})
    else:
        # Graceful fallback — don't crash in case credentials are not set yet
        return JsonResponse({
            'status': 'warning',
            'message': 'WhatsApp API credentials not configured. Please set WA_TOKEN and WA_PHONE_ID in environment.'
        }, status=200)
