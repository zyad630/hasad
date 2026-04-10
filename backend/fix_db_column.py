
import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')
django.setup()

def add_column():
    cursor = connection.cursor()
    print("Checking current status...")
    cursor.execute('PRAGMA table_info(suppliers_customer)')
    cols = [row[1] for row in cursor.fetchall()]
    print("Existing columns:", cols)
    
    if 'commission_type_id' not in cols:
        print("Column MISSING. Adding it...")
        try:
            cursor.execute('ALTER TABLE suppliers_customer ADD COLUMN commission_type_id char(32)')
            print("Successfully added commission_type_id column.")
        except Exception as e:
            print("Error adding column:", e)
    else:
        print("Column ALREADY EXISTS. No action needed.")

if __name__ == "__main__":
    add_column()
