import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hisba_backend.settings')

app = Celery('hisba_backend')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'check-trial-expiration-daily': {
        'task': 'core.tasks.check_trial_expirations',
        'schedule': crontab(hour=0, minute=5), # Run daily at 12:05 AM
    },
    'build-daily-snapshots': {
        'task': 'core.tasks.build_daily_snapshots',
        'schedule': crontab(hour=1, minute=0), # Run daily at 1:00 AM
    },
}
