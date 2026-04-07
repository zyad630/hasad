# Hand-edited migration — handles data migration safely
# Old commission_type was a CharField ('percent'/'fixed')
# New: CommissionType is a proper Model 

from django.db import migrations, models
import django.db.models.deletion
import uuid


def create_default_commission_types_and_link(apps, schema_editor):
    """Migrate old string commission_type values to new CommissionType FK model."""
    CommissionType = apps.get_model('suppliers', 'CommissionType')
    Supplier = apps.get_model('suppliers', 'Supplier')
    Tenant = apps.get_model('core', 'Tenant')

    for tenant in Tenant.objects.all():
        # Create default commission types per tenant
        ct_percent, _ = CommissionType.objects.get_or_create(
            tenant=tenant,
            name='نسبة مئوية',
            defaults={'calc_type': 'percent', 'default_rate': 7.00}
        )
        ct_fixed, _ = CommissionType.objects.get_or_create(
            tenant=tenant,
            name='مبلغ ثابت',
            defaults={'calc_type': 'fixed', 'default_rate': 0.00}
        )
        # Link existing suppliers to appropriate CommissionType
        # Since old field was a CharField, we already cleared it to NULL in step 1
        # All unlinked suppliers → assign percent by default
        Supplier.objects.filter(tenant=tenant, commission_type__isnull=True).update(
            commission_type=ct_percent
        )


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_alter_auditlog_options_alter_customuser_options_and_more'),
        ('suppliers', '0003_customer_notes_supplier_notes'),
    ]

    operations = [
        # Step 1: Remove commission_rate field
        migrations.RemoveField(
            model_name='supplier',
            name='commission_rate',
        ),
        # Step 2: Drop the old commission_type CharField first (set to null text col)
        migrations.AlterField(
            model_name='supplier',
            name='commission_type',
            field=models.CharField(max_length=20, null=True, blank=True, default=None),
        ),
        # Step 3: Clear any stale string values
        migrations.RunSQL(
            sql="UPDATE suppliers_supplier SET commission_type = NULL;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        # Step 4: Create the CommissionType model
        migrations.CreateModel(
            name='CommissionType',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=200, verbose_name='اسم العمولة')),
                ('calc_type', models.CharField(
                    choices=[('percent', 'نسبة مئوية (%)'), ('fixed', 'مبلغ ثابت (ج)')],
                    default='percent', max_length=20, verbose_name='نوع الحساب'
                )),
                ('default_rate', models.DecimalField(decimal_places=2, default=0.0, max_digits=8, verbose_name='نسبة/قيمة العمولة')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.tenant')),
            ],
            options={
                'verbose_name': 'نوع العمولة',
                'verbose_name_plural': 'أنواع العمولات',
            },
        ),
        # Step 5: Rename old column out, add proper FK column
        migrations.RemoveField(
            model_name='supplier',
            name='commission_type',
        ),
        migrations.AddField(
            model_name='supplier',
            name='commission_type',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='suppliers.commissiontype',
                verbose_name='نوع العمولة المرتبط'
            ),
        ),
        # Step 6: Create default types per tenant and link suppliers
        migrations.RunPython(
            create_default_commission_types_and_link,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
