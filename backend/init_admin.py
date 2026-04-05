import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')
django.setup()

from core.models import CustomUser

def create_admin():
    username = 'admin'
    password = '123'
    if not CustomUser.objects.filter(username=username).exists():
        print(f"Creating superuser {username}...")
        CustomUser.objects.create_superuser(username=username, password=password, role='admin')
        print("Superuser created successfully.")
    else:
        print(f"Superuser {username} already exists.")

if __name__ == '__main__':
    create_admin()
