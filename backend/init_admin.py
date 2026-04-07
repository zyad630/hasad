import os
import sys
import django

# Add the 'backend' directory to sys.path so we can import 'core', 'hisba_backend' etc.
current_path = os.path.dirname(os.path.abspath(__file__))
if current_path not in sys.path:
    sys.path.insert(0, current_path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')

try:
    django.setup()
    from core.models import CustomUser, Tenant

    def create_admin():
        username = 'admin'
        password = '123'
        
        # 1. Create a default Tenant if it doesn't exist
        tenant, created = Tenant.objects.get_or_create(
            subdomain='default',
            defaults={
                'name': 'النظام الآلي المركزي',
                'status': 'active'
            }
        )
        if created:
            print(f"Default tenant '{tenant.name}' created.")

        # 2. Create/Update admin user
        user = CustomUser.all_objects.filter(username=username).first()
        if not user:
            print(f"Creating superuser {username}...")
            user = CustomUser.objects.create_superuser(
                username=username, 
                password=password, 
                role='super_admin', # Strict role for Super Admin Dashboard
                tenant=None # Super Admin has no specific tenant
            )
            print("Superuser created successfully.")
        else:
            # Ensure the existing admin has the correct role
            if user.role != 'super_admin':
                user.role = 'super_admin'
                user.save()
            print(f"Superuser {username} already exists.")

    if __name__ == '__main__':
        create_admin()

except Exception as e:
    print(f"CRITICAL ERROR during admin setup: {e}")
    sys.exit(1)
