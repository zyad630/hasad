"""
seed_chart_of_accounts — seeds a professional Palestinian vegetable-market
Chart of Accounts for every tenant that has no account groups yet.

Run: python manage.py seed_chart_of_accounts
"""
from django.core.management.base import BaseCommand
from core.models import Tenant
from finance.models import AccountGroup, Account


COA_TREE = [
    {
        "code": "1", "name": "الأصول", "type": "asset",
        "subs": [
            {
                "code": "11", "name": "الأصول المتداولة", "type": "asset",
                "accounts": [
                    ("1100", "صندوق النقدية"),
                    ("1101", "صندوق الشيكات الواردة"),
                    ("1110", "البنك الرئيسي"),
                    ("1120", "البنك الاحتياطي"),
                ]
            },
            {
                "code": "12", "name": "الذمم المدينة", "type": "asset",
                "accounts": [
                    ("1200", "ذمم التجار (زبونيات)"),
                    ("1201", "ذمم التجار بالدينار (JOD)"),
                    ("1202", "ذمم التجار بالدولار (USD)"),
                ]
            },
            {
                "code": "13", "name": "المخزون والأصول الأخرى", "type": "asset",
                "accounts": [
                    ("1300", "مخزون البضاعة"),
                    ("1310", "طوابق وفوارغ"),
                ]
            },
        ],
    },
    {
        "code": "2", "name": "الخصوم", "type": "liability",
        "subs": [
            {
                "code": "21", "name": "الخصوم المتداولة", "type": "liability",
                "accounts": [
                    ("2100", "ذمم المزارعين (موردين) - شيكل"),
                    ("2101", "ذمم المزارعين - دينار (JOD)"),
                    ("2102", "ذمم المزارعين - دولار (USD)"),
                    ("2110", "شيكات مستحقة للمزارعين"),
                ]
            },
        ],
    },
    {
        "code": "3", "name": "حقوق الملكية", "type": "equity",
        "subs": [
            {
                "code": "31", "name": "رأس المال والاحتياطيات", "type": "equity",
                "accounts": [
                    ("3100", "رأس المال"),
                    ("3200", "الأرباح المتراكمة"),
                ]
            },
        ],
    },
    {
        "code": "4", "name": "الإيرادات", "type": "revenue",
        "subs": [
            {
                "code": "41", "name": "إيرادات العمولات", "type": "revenue",
                "accounts": [
                    ("4100", "عمولة التسويق (%)"),
                    ("4101", "عمولة ثابتة لكل صندوق"),
                ]
            },
            {
                "code": "42", "name": "إيرادات أخرى", "type": "revenue",
                "accounts": [
                    ("4200", "ربح فروقات أسعار الصرف (Forex Gain)"),
                    ("4210", "إيرادات متنوعة"),
                ]
            },
        ],
    },
    {
        "code": "5", "name": "المصروفات", "type": "expense",
        "subs": [
            {
                "code": "51", "name": "مصروفات التشغيل", "type": "expense",
                "accounts": [
                    ("5100", "مصاريف نقل وشحن"),
                    ("5101", "مصاريف تعبئة وتغليف (أكياس/طوابق)"),
                    ("5102", "عمالة فرز وتحزيم"),
                    ("5110", "مصاريف إدارية وعمومية"),
                ]
            },
            {
                "code": "52", "name": "مصروفات مالية", "type": "expense",
                "accounts": [
                    ("5200", "خسارة فروقات أسعار الصرف (Forex Loss)"),
                    ("5210", "فوائد ومصاريف بنكية"),
                    ("5220", "شيكات مرتجعة"),
                ]
            },
        ],
    },
]


class Command(BaseCommand):
    help = "Seed default Chart of Accounts for all tenants that have none"

    def handle(self, *args, **options):
        tenants = Tenant.objects.all()
        if not tenants.exists():
            self.stdout.write(self.style.WARNING("No tenants found. Create a tenant first."))
            return

        for tenant in tenants:
            if AccountGroup.objects.filter(tenant=tenant).exists():
                self.stdout.write(f"[{tenant.name}] Already has COA — skipping.")
                continue

            self.stdout.write(f"[{tenant.name}] Seeding Chart of Accounts...")

            for main_item in COA_TREE:
                # Create main group
                main_group = AccountGroup.objects.create(
                    tenant=tenant,
                    name=main_item["name"],
                    code=main_item["code"],
                    account_type=main_item["type"],
                    parent=None,
                )

                for sub_item in main_item.get("subs", []):
                    # Create sub-group
                    sub_group = AccountGroup.objects.create(
                        tenant=tenant,
                        name=sub_item["name"],
                        code=sub_item["code"],
                        account_type=sub_item["type"],
                        parent=main_group,
                    )

                    for acc_code, acc_name in sub_item.get("accounts", []):
                        Account.objects.create(
                            tenant=tenant,
                            group=sub_group,
                            name=acc_name,
                            code=acc_code,
                            is_active=True,
                        )

            total_groups = AccountGroup.objects.filter(tenant=tenant).count()
            total_accounts = Account.objects.filter(tenant=tenant).count()
            self.stdout.write(self.style.SUCCESS(
                f"[{tenant.name}] Seeded {total_groups} groups and {total_accounts} accounts - DONE"
            ))
