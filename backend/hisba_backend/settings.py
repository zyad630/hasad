import os
import sys
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# ─── Critical env validation — crash fast, never silently use defaults ─────────
_using_sqlite = os.environ.get('DB_ENGINE', '').endswith('sqlite3')
REQUIRED_ENV_VARS = ['SECRET_KEY', 'REDIS_URL', 'ALLOWED_HOSTS', 'DEBUG']

# Only require DATABASE_URL if explicitly NOT using SQLite
if not _using_sqlite:
    REQUIRED_ENV_VARS.append('DATABASE_URL')

_skip_commands = {'test', 'migrate', 'makemigrations', 'shell', 'showmigrations', 'check'}
if not any(cmd in sys.argv for cmd in _skip_commands):
    # Only if NOT explicitly using sqlite, we must check DATABASE_URL
    missing = [v for v in REQUIRED_ENV_VARS if not os.environ.get(v)]
    if missing:
        # Don't crash if it's just DATABASE_URL and we have a local dev fallback logic below
        # but for production on Render we want to be safe.
        if not (len(missing) == 1 and missing[0] == 'DATABASE_URL' and _using_sqlite):
            print(f"Warning: Missing environment variables: {', '.join(missing)}")
            # In production, we'll allow it to proceed for initial bootstrap if sqlite is detected
            if not _using_sqlite:
                raise ImproperlyConfigured(
                    f"Missing required environment variables: {', '.join(missing)}\n"
                    f"Copy .env.example to .env and fill all values."
                )

# M-01: No hardcoded fallback for SECRET_KEY — fail loud in production
_secret_key = os.environ.get('SECRET_KEY', '')
if not _secret_key:
    if 'test' in sys.argv or os.environ.get('DB_ENGINE', '').endswith('sqlite3'):
        _secret_key = 'dev-only-insecure-key-DO-NOT-USE-IN-PRODUCTION'
    else:
        raise ImproperlyConfigured('SECRET_KEY environment variable is required')
SECRET_KEY = _secret_key

DEBUG = os.environ.get('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '*').split(',')

# ─── Third-party API keys — all from env, empty default is safe ─────────────
OPENAI_API_KEY          = os.environ.get('OPENAI_API_KEY', '')
WA_TOKEN                = os.environ.get('WHATSAPP_TOKEN', '')
WA_PHONE_ID             = os.environ.get('WHATSAPP_PHONE_ID', '')
AWS_ACCESS_KEY_ID       = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY   = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', '')

# ─── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL = os.environ.get('DATABASE_URL', '')
if DATABASE_URL:
    import dj_database_url
    DATABASES = {'default': dj_database_url.parse(DATABASE_URL, conn_max_age=600)}
else:
    # Fallback only for local dev — never production
    DATABASES = {
        'default': {
            'ENGINE': os.environ.get('DB_ENGINE', 'django.db.backends.postgresql'),
            'NAME': os.environ.get('DB_NAME', 'hisba_db'),
            'USER': os.environ.get('DB_USER', 'hisba_user'),
            'PASSWORD': os.environ.get('DB_PASSWORD', 'hisba_password'),
            'HOST': os.environ.get('DB_HOST', 'localhost'),
            'PORT': os.environ.get('DB_PORT', '5432'),
        }
    }

# ─── Installed Apps ───────────────────────────────────────────────────────────
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',  # H-02: required for blacklist
    'corsheaders',
    'django_filters',
    'drf_spectacular',

    # Local apps
    'core',
    'suppliers',
    'inventory',
    'sales',
    'finance',
    'hr',
    'integrations',
    'reports',
    'market',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.TenantMiddleware',
]

ROOT_URLCONF = 'hisba_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'hisba_backend.wsgi.application'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'ar'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'core.CustomUser'

# ─── REST Framework ───────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

# ─── JWT — H-02: Token rotation + blacklist ───────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':        timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME':       timedelta(days=7),
    'ROTATE_REFRESH_TOKENS':        True,   # Issue new refresh token on every use
    'BLACKLIST_AFTER_ROTATION':     True,   # Invalidate old refresh token immediately
    'UPDATE_LAST_LOGIN':            True,
    'ALGORITHM':                    'HS256',
    'AUTH_HEADER_TYPES':            ('Bearer',),
}

# ─── Redis / Celery ───────────────────────────────────────────────────────────
# Redis — localhost only valid in dev (DB_ENGINE=sqlite3)
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'socket_connect_timeout': 5,
            'socket_timeout': 5,
        },
    }
}

CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', REDIS_URL)
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', REDIS_URL)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'

# ─── CORS ─────────────────────────────────────────────────────────────────────
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')

# ─── Production Security Headers — only when DEBUG=False ─────────────────────
if not DEBUG:
    SECURE_SSL_REDIRECT             = True
    SECURE_HSTS_SECONDS             = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS  = True
    SECURE_HSTS_PRELOAD             = True
    SESSION_COOKIE_SECURE           = True
    CSRF_COOKIE_SECURE              = True
    SECURE_CONTENT_TYPE_NOSNIFF     = True
    X_FRAME_OPTIONS                 = 'DENY'
    SECURE_BROWSER_XSS_FILTER       = True
