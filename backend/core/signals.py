from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.forms.models import model_to_dict
from .models import AuditLog
from .managers import get_current_tenant
from django.contrib.auth import get_user_model
import threading

# Use thread-local to capture the current user from middleware
_thread_locals = threading.local()

def set_current_user(user):
    _thread_locals.user = user

def get_current_user():
    return getattr(_thread_locals, 'user', None)

# List of models we want to audit
AUDITED_MODELS_APPS = ['inventory', 'finance', 'market', 'suppliers']

@receiver(post_save)
def audit_save(sender, instance, created, **kwargs):
    if sender._meta.app_label not in AUDITED_MODELS_APPS:
        return

    tenant = getattr(instance, 'tenant', get_current_tenant())
    if not tenant: return

    action = 'create' if created else 'update'
    
    # Avoid recursion
    if sender == AuditLog: return

    AuditLog.objects.create(
        tenant=tenant,
        user=get_current_user(),
        action=f"{action}_{sender._meta.model_name}",
        entity_id=str(instance.pk),
        entity_type=sender._meta.verbose_name,
        after_data=model_to_dict(instance),
    )

@receiver(post_delete)
def audit_delete(sender, instance, **kwargs):
    if sender._meta.app_label not in AUDITED_MODELS_APPS:
        return

    tenant = getattr(instance, 'tenant', get_current_tenant())
    if not tenant: return
    
    if sender == AuditLog: return

    AuditLog.objects.create(
        tenant=tenant,
        user=get_current_user(),
        action=f"delete_{sender._meta.model_name}",
        entity_id=str(instance.pk),
        entity_type=sender._meta.verbose_name,
        before_data=model_to_dict(instance),
    )
