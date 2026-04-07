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
    
    # 2. Force ONLY admin / 123 as the super admin
    # First, rename or delete old super_hassad if it exists
    CustomUser.all_objects.filter(username='super_hassad').delete()
    
    user = CustomUser.all_objects.filter(username='admin').first()
    if not user:
        CustomUser.objects.create_superuser(
            username='admin', 
            password='123', 
            role='super_admin', 
            tenant=None
        )
    else:
        user.set_password('123')
        user.role = 'super_admin'
        user.is_staff = True
        user.is_superuser = True
        user.save()

except Exception as e:
    # Safely ignore if DB hasn't been migrated yet, etc.
    print("Auto-Init Admin failed safely:", str(e))
