# Apache Superset конфигурация для CRM Analytics
import os
from flask_appbuilder.security.manager import AUTH_DB

# Основные настройки
SECRET_KEY = os.environ.get('SUPERSET_SECRET_KEY', 'crm-superset-secret-key-123456789')
SQLALCHEMY_DATABASE_URI = f"postgresql://{os.environ.get('DATABASE_USER', 'postgres')}:{os.environ.get('DATABASE_PASSWORD', 'password')}@{os.environ.get('DATABASE_HOST', 'postgres-analytics-fresh')}:{os.environ.get('DATABASE_PORT', '5432')}/{os.environ.get('DATABASE_DB', 'superset')}"

# Redis конфигурация для кэша и Celery
REDIS_HOST = os.environ.get('REDIS_HOST', 'redis-analytics')
REDIS_PORT = os.environ.get('REDIS_PORT', '6379')
REDIS_CELERY_DB = os.environ.get('REDIS_CELERY_DB', '2')
REDIS_RESULTS_DB = os.environ.get('REDIS_RESULTS_DB', '3')

# Celery конфигурация для асинхронных задач
class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    imports = ("superset.sql_lab", "superset.tasks")
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"
    worker_prefetch_multiplier = 10
    task_acks_late = True
    task_annotations = {
        "sql_lab.get_sql_results": {
            "rate_limit": "100/s",
        },
    }

CELERY_CONFIG = CeleryConfig

# Безопасность
AUTH_TYPE = AUTH_DB
AUTH_USER_REGISTRATION = False
AUTH_USER_REGISTRATION_ROLE = "Gamma"  # Только для новых пользователей

# Включить функции аналитики
FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
    "DASHBOARD_NATIVE_FILTERS": True,
    "DASHBOARD_CROSS_FILTERS": True,
    "DASHBOARD_RBAC": True,
    "EMBEDDED_SUPERSET": True,
    "SQL_VALIDATORS_BY_ENGINE": True,
    "ALERT_REPORTS": False,  # Отключено для упрощения
}

# Настройки SQL Lab
SQLLAB_TIMEOUT = 300
SQLLAB_ASYNC_TIME_LIMIT_SEC = 600
SUPERSET_WEBSERVER_TIMEOUT = 300

# Размеры результатов
ROW_LIMIT = 10000
VIZ_ROW_LIMIT = 10000
SAMPLES_ROW_LIMIT = 1000

# Кэширование
CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 300,
    'CACHE_KEY_PREFIX': 'superset_',
    'CACHE_REDIS_HOST': REDIS_HOST,
    'CACHE_REDIS_PORT': REDIS_PORT,
    'CACHE_REDIS_DB': 1,
}

# Настройки для встраивания дашбордов
GUEST_ROLE_NAME = "CRM Guest"
GUEST_TOKEN_JWT_SECRET = SECRET_KEY
GUEST_TOKEN_JWT_ALGO = "HS256"
GUEST_TOKEN_HEADER_NAME = "X-GuestToken"
GUEST_TOKEN_JWT_EXP_SECONDS = 300  # 5 минут

# Настройки безопасности CORS
ENABLE_CORS = True
CORS_OPTIONS = {
    'supports_credentials': True,
    'allow_headers': ['*'],
    'resources': ['*'],
    'origins': ['http://localhost:3000', 'http://localhost:8080']
}

# Логирование
ENABLE_TIME_ROTATE = False
# TIME_ROTATE_LOG_LEVEL = "INFO"
# FILENAME = os.path.join("/app/logs/", "superset.log")

# Дополнительные настройки для производительности
WTF_CSRF_ENABLED = True
WTF_CSRF_EXEMPT_LIST = []
WTF_CSRF_TIME_LIMIT = None

# Настройки локализации
LANGUAGES = {
    'en': {'flag': 'us', 'name': 'English'},
    'ru': {'flag': 'ru', 'name': 'Russian'},
}

# Метрики и аналитика - создаем заглушку
class DummyStatsLogger:
    def incr(self, *args, **kwargs):
        pass
    def timing(self, *args, **kwargs):
        pass
    def gauge(self, *args, **kwargs):
        pass

STATS_LOGGER = DummyStatsLogger()
STATS_LOGGER_MANAGER = type('obj', (object,), {'instance': DummyStatsLogger()})

# Отключаем логирование действий пользователей
ENABLE_ACCESS_LOG = False
FAB_LOG_LEVEL = "ERROR"

# Настройки экспорта
CSV_EXPORT = {
    "encoding": "utf-8",
}

EXCEL_EXPORT = {
    "encoding": "utf-8",
}

# Предустанавливаемые источники данных
CLICKHOUSE_CONFIG = {
    'uri': f"clickhousedb://analytics:analytics_password@clickhouse-analytics:8123/crm_analytics",
    'name': 'CRM ClickHouse',
    'description': 'Основное хранилище данных CRM аналитики'
}

POSTGRES_CONFIG = {
    'uri': SQLALCHEMY_DATABASE_URI.replace('/superset', '/salesforce_clone'),
    'name': 'CRM PostgreSQL',
    'description': 'Основная база данных CRM'
}

print("✅ Superset конфигурация для CRM Analytics загружена")