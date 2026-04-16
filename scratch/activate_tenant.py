import os
import django
import sys

# Setup django
sys.path.append(os.getcwd() + '/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')
django.setup()

from core.models import Tenant

tenants = Tenant.objects.all()
print("Tenants in database:")
for t in tenants:
    print(f"ID: {t.id}, Name: {t.name}, Subdomain: {t.subdomain}, Status: {t.status}")

# Activate zyad if it's suspended
zyad = Tenant.objects.filter(subdomain='zyad').first()
if zyad and zyad.status != 'active':
    print(f"Activating tenant: {zyad.name}")
    zyad.status = 'active'
    zyad.save()
    print("Tenant activated successfully.")
else:
    print("Tenant 'zyad' is already active or not found.")
