from django.core.management.base import BaseCommand
from django.apps import apps
from django.db.models import FloatField

class Command(BaseCommand):
    help = 'Audit all models to ensure no FloatField is used for financial data'

    def handle(self, *args, **kwargs):
        violations = []
        for app_config in apps.get_app_configs():
            for model in app_config.get_models():
                for field in model._meta.get_fields():
                    if isinstance(field, FloatField):
                        violations.append(f"{model.__name__}.{field.name}")
        
        if violations:
            self.stdout.write(self.style.ERROR(f"CRITICAL: Found {len(violations)} FloatFields. They must be replaced with DecimalField(max_digits=18, decimal_places=2)."))
            for v in violations:
                self.stdout.write(self.style.WARNING(f" - {v}"))
        else:
            self.stdout.write(self.style.SUCCESS("AUDIT PASSED: Zero FloatFields detected in the models."))
