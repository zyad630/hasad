from django.db import migrations, connection


def create_indexes(apps, schema_editor):
    """Run CONCURRENTLY for PostgreSQL; plain CREATE INDEX for SQLite (dev only)."""
    is_postgres = connection.vendor == 'postgresql'

    indexes = [
        ('idx_sale_tenant_date',   'sales_sale(tenant_id, sale_date DESC)'),
        ('idx_sale_payment_type',  'sales_sale(tenant_id, payment_type)'),
        ('idx_sale_cancelled',     'sales_sale(tenant_id, is_cancelled)'),
        ('idx_saleitem_shipment',  'sales_saleitem(shipment_item_id)'),
        ('idx_shipment_status',    'inventory_shipment(tenant_id, status)'),
        ('idx_ledger_account',     'finance_ledgerentry(tenant_id, account_type, account_id)'),
        ('idx_auditlog_tenant',    'core_auditlog(tenant_id, created_at DESC)'),
    ]

    with schema_editor.connection.cursor() as cursor:
        for name, columns in indexes:
            if is_postgres:
                cursor.execute(
                    f'CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} ON {columns};'
                )
            else:
                # SQLite: no IF NOT EXISTS support for indexes before 3.3.7,
                # use try/except to skip if already exists
                try:
                    cursor.execute(f'CREATE INDEX {name} ON {columns};')
                except Exception:
                    pass  # Already exists — safe to ignore in dev


def drop_indexes(apps, schema_editor):
    is_postgres = connection.vendor == 'postgresql'
    names = [
        'idx_sale_tenant_date', 'idx_sale_payment_type', 'idx_sale_cancelled',
        'idx_saleitem_shipment', 'idx_shipment_status',
        'idx_ledger_account', 'idx_auditlog_tenant',
    ]
    with schema_editor.connection.cursor() as cursor:
        for name in names:
            if is_postgres:
                cursor.execute(f'DROP INDEX CONCURRENTLY IF EXISTS {name};')
            else:
                try:
                    cursor.execute(f'DROP INDEX IF EXISTS {name};')
                except Exception:
                    pass


class Migration(migrations.Migration):
    atomic = False  # Required for CONCURRENTLY in PostgreSQL

    dependencies = [('core', '0003_auditlog_tenantdailysnapshot')]

    operations = [
        migrations.RunPython(create_indexes, reverse_code=drop_indexes),
    ]
