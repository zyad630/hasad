import uuid
from django.db import models
from django.core.serializers.json import DjangoJSONEncoder
from core.models import Tenant

class MessageType(models.TextChoices):
    SETTLEMENT = 'settlement', 'Settlement'
    DEBT_ALERT = 'debt_alert', 'Debt Alert'
    REMINDER = 'reminder', 'Reminder'

class MessageStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    SENT = 'sent', 'Sent'
    FAILED = 'failed', 'Failed'

class WhatsAppMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    recipient_phone = models.CharField(max_length=20)
    message_type = models.CharField(max_length=20, choices=MessageType.choices)
    status = models.CharField(max_length=10, choices=MessageStatus.choices, default=MessageStatus.PENDING)
    reference_id = models.UUIDField(null=True, blank=True)
    error_message = models.TextField(blank=True, null=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"WhatsApp to {self.recipient_phone} ({self.status})"

class AlertSeverity(models.TextChoices):
    LOW = 'low', 'Low'
    MEDIUM = 'medium', 'Medium'
    HIGH = 'high', 'High'

class AlertType(models.TextChoices):
    HIGH_DEBT = 'high_debt', 'High Debt'
    SLOW_ITEM = 'slow_item', 'Slow Item'
    LOW_COLLECTION = 'low_collection', 'Low Collection'

class AIAlert(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    alert_type = models.CharField(max_length=20, choices=AlertType.choices)
    severity = models.CharField(max_length=10, choices=AlertSeverity.choices, default=AlertSeverity.LOW)
    title = models.CharField(max_length=300)
    details = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.alert_type} - {self.title}"
