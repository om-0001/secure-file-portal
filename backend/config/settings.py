"""
Django settings for Secure File Exchange Portal.

Designed for high security, clear modularity, and beginner-friendly readability.
Cryptographic Ephemeral Link Control with AES-256-GCM and ClamAV scanning.
"""

from pathlib import Path
import os
import sys
from dotenv import load_dotenv
import dj_database_url

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Include 'apps' directory in python sys.path for clean, direct app imports
sys.path.insert(0, str(BASE_DIR / 'apps'))

# Load environment variables from root .env or backend .env
ROOT_ENV_PATH = BASE_DIR.parent / '.env'
if ROOT_ENV_PATH.exists():
    load_dotenv(ROOT_ENV_PATH)
else:
    load_dotenv(BASE_DIR / '.env')

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv(
    'DJANGO_SECRET_KEY',
    'django-insecure-dev-key-secure-portal-development-only-2026'
)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 't')

raw_allowed_hosts = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1,.onrender.com,.railway.app,.vercel.app')
ALLOWED_HOSTS = [h.strip() for h in raw_allowed_hosts.split(',') if h.strip()]
if '*' in ALLOWED_HOSTS:
    ALLOWED_HOSTS = ['*']


# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party packages
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',

    # Internal Core Modular Applications
    'accounts.apps.AccountsConfig',
    'security.apps.SecurityConfig',
    'malware_scanner.apps.MalwareScannerConfig',
    'files.apps.FilesConfig',
    'access_control.apps.AccessControlConfig',
]

# Custom User Model
AUTH_USER_MODEL = 'accounts.User'

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Must be as high as possible
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # WhiteNoise for production static files
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

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

WSGI_APPLICATION = 'config.wsgi.application'


# Database Configuration
# Priority 1: DATABASE_URL (for hosted Postgres on Render, Neon, Supabase, Railway)
# Priority 2: DB_ENGINE == 'postgresql'
# Priority 3: SQLite (local fallback)
DATABASE_URL = os.getenv('DATABASE_URL')
DB_ENGINE = os.getenv('DB_ENGINE', 'sqlite').lower()

if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
elif DB_ENGINE == 'postgresql':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME', 'secure_file_portal'),
            'USER': os.getenv('DB_USER', 'postgres'),
            'PASSWORD': os.getenv('DB_PASSWORD', 'postgres'),
            'HOST': os.getenv('DB_HOST', 'localhost'),
            'PORT': os.getenv('DB_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# Password validation & Hashing
# Django uses PBKDF2 with SHA-256 by default (secure password hashing)
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# Django REST Framework Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}


# CORS Settings for React frontend
raw_cors = os.getenv(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000,http://127.0.0.1:3000'
)
CORS_ALLOWED_ORIGINS = [orig.strip() for orig in raw_cors.split(',') if orig.strip()]
if 'https://secure-file-frontend-ufd1.onrender.com' not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append('https://secure-file-frontend-ufd1.onrender.com')

CORS_ALLOW_CREDENTIALS = True

# Whitelist any subdomain on .onrender.com or .vercel.app
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https:\/\/.*\.onrender\.com$",
    r"^https:\/\/.*\.vercel\.app$",
]

# Allow all origins only when DEBUG=True and not explicitly locked
if DEBUG and not os.getenv('CORS_ALLOWED_ORIGINS'):
    CORS_ALLOW_ALL_ORIGINS = True

# CSRF Trusted Origins for modern Django origin verification
raw_csrf = os.getenv(
    'CSRF_TRUSTED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000,http://127.0.0.1:3000'
)
CSRF_TRUSTED_ORIGINS = [orig.strip() for orig in raw_csrf.split(',') if orig.strip()]
if 'https://*.onrender.com' not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append('https://*.onrender.com')
if 'https://secure-file-frontend-ufd1.onrender.com' not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append('https://secure-file-frontend-ufd1.onrender.com')


# Production HTTPS, Cookies, and Proxy Headers
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
if not DEBUG:
    SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'True').lower() in ('true', '1')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True


# Secure Storage Paths
# In production, can be set to persistent volume mount (e.g. /var/data/storage on Render)
STORAGE_ENV = os.getenv('STORAGE_DIR')
if STORAGE_ENV:
    STORAGE_DIR = Path(STORAGE_ENV)
else:
    STORAGE_DIR = BASE_DIR.parent / 'storage'

QUARANTINE_DIR = STORAGE_DIR / 'quarantine'
ENCRYPTED_VAULT_DIR = STORAGE_DIR / 'encrypted'
TEST_SAMPLES_DIR = STORAGE_DIR / 'test_samples'

# Ensure directories exist
QUARANTINE_DIR.mkdir(parents=True, exist_ok=True)
ENCRYPTED_VAULT_DIR.mkdir(parents=True, exist_ok=True)
TEST_SAMPLES_DIR.mkdir(parents=True, exist_ok=True)


# Cryptographic Configuration
# 32-byte master key for AES-256 key management
MASTER_ENCRYPTION_KEY = os.getenv(
    'MASTER_ENCRYPTION_KEY',
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
)

# ClamAV Malware Scanner Configuration
CLAMAV_ENABLED = os.getenv('CLAMAV_ENABLED', 'False').lower() in ('true', '1', 't')
CLAMAV_HOST = os.getenv('CLAMAV_HOST', 'localhost')
CLAMAV_PORT = int(os.getenv('CLAMAV_PORT', '3310'))

# Frontend Host URL for generating full ephemeral links
FRONTEND_URL = os.getenv(
    'FRONTEND_URL',
    'http://localhost:5173' if DEBUG else 'https://secure-file-frontend-ufd1.onrender.com'
)
