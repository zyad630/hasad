"""
Management command to seed common Arab banks into the database.
Run: python manage.py seed_banks
"""
from django.core.management.base import BaseCommand
from core.models import Bank


BANKS = [
    {'code': 'PAL', 'name_ar': 'البنك العربي', 'name_en': 'Arab Bank', 'swift_code': 'ARABPSJX'},
    {'code': 'BOP', 'name_ar': 'بنك فلسطين', 'name_en': 'Bank of Palestine', 'swift_code': 'PALSPS22'},
    {'code': 'QUDS', 'name_ar': 'بنك القدس', 'name_en': 'Bank Al-Quds', 'swift_code': 'QUDSPS22'},
    {'code': 'CAB', 'name_ar': 'البنك التجاري الفلسطيني', 'name_en': 'Commercial Bank', 'swift_code': 'COBKPSJX'},
    {'code': 'NBP', 'name_ar': 'البنك الوطني الفلسطيني', 'name_en': 'National Bank of Palestine', 'swift_code': 'NATBPS22'},
    {'code': 'JTAB', 'name_ar': 'بنك الإسكان الأردني', 'name_en': 'Jordan Ahli Bank', 'swift_code': 'AHLIJOAM'},
    {'code': 'JAFI', 'name_ar': 'بنك القاهرة عمان', 'name_en': 'Cairo Amman Bank', 'swift_code': 'CAABJOAM'},
    {'code': 'EGYPT', 'name_ar': 'البنك الأهلي المصري', 'name_en': 'National Bank of Egypt', 'swift_code': 'NBEGEGCX'},
    {'code': 'CIB', 'name_ar': 'البنك التجاري الدولي', 'name_en': 'Commercial International Bank', 'swift_code': 'CIBEEGCX'},
    {'code': 'HAPOALIM', 'name_ar': 'بنك هبوعليم', 'name_en': 'Bank Hapoalim', 'swift_code': 'POALILIT'},
    {'code': 'LEUM', 'name_ar': 'بنك ليئومي', 'name_en': 'Bank Leumi', 'swift_code': 'LUMIILITI'},
    {'code': 'DISCOUNT', 'name_ar': 'بنك ديسكونت', 'name_en': 'Bank Discount', 'swift_code': 'DISCILIT'},
    {'code': 'MIZRAHI', 'name_ar': 'بنك مزراحي طفاحوت', 'name_en': 'Mizrahi Tefahot', 'swift_code': 'MISLILIM'},
    {'code': 'PAGI', 'name_ar': 'بنك הפגי', 'name_en': 'Yahav Bank', 'swift_code': 'YAHVILIT'},
    {'code': 'OTZAR', 'name_ar': 'بنك أوتزار هاحيال', 'name_en': 'Otsar Ha-Hayal', 'swift_code': 'OTHAILIT'},
]


class Command(BaseCommand):
    help = 'Seed common Arab/Israeli banks into the database'

    def handle(self, *args, **options):
        created = 0
        skipped = 0
        for bank_data in BANKS:
            obj, was_created = Bank.objects.get_or_create(
                code=bank_data['code'],
                defaults={
                    'name_ar': bank_data['name_ar'],
                    'name_en': bank_data['name_en'],
                    'swift_code': bank_data.get('swift_code', ''),
                }
            )
            if was_created:
                created += 1
                self.stdout.write(f"  [+] Created: {obj}")
            else:
                skipped += 1

        self.stdout.write(f"\nDone! Created {created} banks, skipped {skipped} existing.")
