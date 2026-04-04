import requests
from django.conf import settings

class WhatsAppService:
    @staticmethod
    def send_message(phone, message):
        # Prevent trailing/leading spaces or plus signs from breaking API
        clean_phone = ''.join(filter(str.isdigit, str(phone)))
        
        # We check for missing tokens, and just return a mock success if we haven't configured them.
        phone_id = getattr(settings, 'WA_PHONE_ID', None)
        token = getattr(settings, 'WA_TOKEN', None)
        
        if not phone_id or not token:
            print(f"[MOCK WA] Sending to {clean_phone}: {message}")
            return type('Response', (object,), {"status_code": 200, "json": lambda: {"mock": True}})()
            
        url = f"https://graph.facebook.com/v17.0/{phone_id}/messages"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": clean_phone,
            "type": "text",
            "text": {"body": message}
        }
        
        try:
            return requests.post(url, headers=headers, json=payload, timeout=5)
        except Exception as e:
            print(f"[WA Error] {str(e)}")
            return type('Response', (object,), {"status_code": 500, "text": str(e)})()
