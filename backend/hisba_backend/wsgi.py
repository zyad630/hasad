"""
WSGI config for hisba_backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')

application = get_wsgi_application()

# --- Auto DB Init for Render Free Tier (No Shell Required) ---
try:
    from core.models import CustomUser, Tenant
    
    # 1. Default Tenant
    tenant, _ = Tenant.objects.get_or_create(
        subdomain='default',
        defaults={'name': 'النظام الآلي المركزي', 'status': 'active'}
    )
    
    # 2. Super_hassad admin
    user = CustomUser.all_objects.filter(username='super_hassad').first()
    if not user:
        CustomUser.objects.create_superuser(
            username='super_hassad', 
            password='12345678', 
            role='super_admin', 
            tenant=None
        )
    elif user.role != 'super_admin':
        user.role = 'super_admin'
        user.save()
except Exception as e:
    # Safely ignore if DB hasn't been migrated yet, etc.
    print("Auto-Init Admin failed safely:", str(e))
