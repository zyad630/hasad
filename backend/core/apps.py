from django.apps import AppConfig

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
    verbose_name = "Hisba SaaS Core"

    def ready(self):
        """Initialize core SaaS settings and signals when Django 6 boots up."""
        import core.managers
        print("[+] Hisba SaaS Core: Tenant Isolation Engine Loaded.")
