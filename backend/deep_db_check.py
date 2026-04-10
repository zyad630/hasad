import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hisba_backend.settings")
django.setup()

from django.apps import apps
from django.db import connection

def check_schema():
    print('Starting deep DB validation against models...')
    all_good = True
    missing_tables = []
    missing_columns = []
    
    for model in apps.get_models():
        if not model._meta.managed: continue
        table_name = model._meta.db_table
        
        with connection.cursor() as cursor:
            cursor.execute(f"PRAGMA table_info('{table_name}')")
            columns = [row[1] for row in cursor.fetchall()]
            
            if not columns:
                missing_tables.append(table_name)
                all_good = False
                continue
                
            for field in model._meta.local_fields:
                if field.column not in columns:
                    missing_columns.append((table_name, field.column))
                    all_good = False

    if all_good:
        print('✅ ALL TABLES AND COLUMNS PERFECTLY MATCH MODELS. NO MISSING DATA.')
    else:
        print('⚠️ FATAL SCHEMA MISMATCH DETECTED:')
        for t in missing_tables:
            print(f'   - ❌ MISSING TABLE: {t}')
        for t, c in missing_columns:
            print(f'   - ❌ MISSING COLUMN in {t}: {c}')

if __name__ == "__main__":
    check_schema()
