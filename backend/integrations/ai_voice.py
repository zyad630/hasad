from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
import jwt # PyJWT for confirmation token
from django.conf import settings

# Fictional imports mimicking real services requested
class S3Service:
    @staticmethod
    def upload(file, path, metadata):
        # Mocks uploading to AWS S3 and returns a URL
        return f"https://my-saas-bucket.s3.amazonaws.com/{path}"

class WhisperService:
    @staticmethod
    def transcribe(file):
        return "15 boxes of tomatoes from farmer Ahmed at 10 shekels each."

class OpenAIService:
    @staticmethod
    def extract_sale_data(text):
        # Mocks OpenAI API extracting JSON logic
        return {
            "items": [{"shipment_item_id": 1, "quantity": 15, "unit_price": 10.00}],
            "payment_type": "cash",
            "customer_id": None
        }

from sales.services import SaleService
from sales.serializers import SaleSerializer

def generate_confirmation_token(extracted_data):
    # Generates a tamper-proof cryptoghraphical token that expires in 5 minutes
    payload = {
        'data': extracted_data,
        'exp': timezone.now() + timezone.timedelta(minutes=5)
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')

def verify_confirmation_token(token):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        return payload['data']
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid token")


class AIVoiceProcessView(APIView):
    """
    Step 1: Receives audio, transcribes it, uses LLM to parse data.
    CRITICAL: Does NOT save to DB. Returns parsed data for human eye check.
    """
    def post(self, request):
        if 'audio' not in request.FILES:
            return Response({'error': 'Audio file required'}, status=400)
            
        audio_file = request.FILES['audio']
        tenant = getattr(request, 'tenant', request.user.tenant)

        # Store audio permanently for dispute resolution (CRITICAL FOR LIABILITY)
        audio_url = S3Service.upload(
            file=audio_file,
            path=f"voice-logs/{tenant.id}/{timezone.now().isoformat()}.webm",
            metadata={
                'tenant_id': str(tenant.id),
                'user_id': str(request.user.id),
                'timestamp': timezone.now().isoformat(),
            }
        )

        transcript = WhisperService.transcribe(audio_file)
        extracted = OpenAIService.extract_sale_data(transcript)

        return Response({
            'status': 'pending_confirmation',
            'transcript': transcript,          # What the AI actually heard
            'extracted': extracted,            # What the AI thinks the numbers are
            'audio_url': audio_url,            # Permanent evidence URL
            'confirmation_token': generate_confirmation_token(extracted),
            'warning': 'Please verify all quantities before confirming'
        })


class AIVoiceConfirmView(APIView):
    """
    Step 2: Human hit "confirm" on the parsing. Payload contains only the token.
    Decodes the tamper-proof token and fires the real SQL atomic transaction.
    """
    def post(self, request):
        token = request.data.get('confirmation_token')
        if not token:
            return Response({'error': 'Confirmation token missing'}, status=400)

        try:
            extracted = verify_confirmation_token(token)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)

        tenant = getattr(request, 'tenant', request.user.tenant)

        # Proceed directly to the pessimistic-locking protected service
        sale = SaleService.create_sale(
            tenant=tenant,
            user=request.user,
            items_data=extracted['items'],
            payment_type=extracted['payment_type'],
            customer_id=extracted.get('customer_id')
        )
        # Note: Assume SaleSerializer is imported and implemented
        return Response({'success': True, 'sale_id': sale.id}, status=201)
