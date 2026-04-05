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
    from core.models import CustomUser

    def create_admin():
        username = 'admin'
        password = '123'
        if not CustomUser.objects.filter(username=username).exists():
            print(f"Creating superuser {username}...")
            # Note: CustomUser uses 'admin' as a role if applicable, 
            # we make sure it's created with correct superuser flags
            CustomUser.objects.create_superuser(
                username=username, 
                password=password, 
                role='admin'
            )
            print("Superuser created successfully.")
        else:
            print(f"Superuser {username} already exists.")

    if __name__ == '__main__':
        create_admin()

except Exception as e:
    print(f"CRITICAL ERROR during admin setup: {e}")
    sys.exit(1)
