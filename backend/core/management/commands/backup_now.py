import subprocess
import os
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Trigger an immediate database backup and verify it'

    def handle(self, *args, **options):
        script = os.environ.get('BACKUP_SCRIPT', '/scripts/backup.sh')

        if not os.path.exists(script):
            self.stdout.write(
                self.style.ERROR(f'Backup script not found: {script}')
            )
            raise SystemExit(1)

        self.stdout.write(f'Running backup: {script}')

        result = subprocess.run(
            ['/bin/bash', script],
            capture_output=True,
            text=True,
            env={**os.environ}
        )

        if result.stdout:
            self.stdout.write(result.stdout)

        if result.returncode == 0:
            self.stdout.write(self.style.SUCCESS('Backup completed successfully'))
        else:
            self.stdout.write(self.style.ERROR('Backup FAILED'))
            if result.stderr:
                self.stdout.write(result.stderr)
            raise SystemExit(1)
