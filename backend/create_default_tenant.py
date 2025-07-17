"""
Скрипт для создания дефолтного tenant в PostgreSQL
"""
import uuid
import sys
import os

# Добавляем путь к backend в sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.database import Base, engine

# Импортируем все модели для создания таблиц
from app.models import tenant, user, contact, company, opportunity, token

def create_tables():
    """Создает все таблицы в базе данных"""
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Таблицы созданы успешно")
    except Exception as e:
        print(f"❌ Ошибка создания таблиц: {e}")

def create_default_tenant():
    """Создает дефолтный tenant"""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Проверяем, существует ли уже дефолтный tenant
        existing_tenant = db.query(tenant.Tenant).filter(tenant.Tenant.subdomain == "default").first()
        
        if not existing_tenant:
            # Создаем дефолтный tenant
            tenant_id = str(uuid.uuid4()) if settings.DATABASE_URL.startswith("sqlite") else uuid.uuid4()
            default_tenant = tenant.Tenant(
                id=tenant_id,
                name="Default Tenant",
                domain="localhost",
                subdomain="default",
                is_active=True,
                max_users=1000,
                max_storage_gb=100,
                theme="light",
                timezone="UTC",
                locale="en"
            )
            
            db.add(default_tenant)
            db.commit()
            print(f"✅ Дефолтный tenant создан: {default_tenant.id}")
        else:
            print(f"✅ Дефолтный tenant уже существует: {existing_tenant.id}")
            
    except Exception as e:
        print(f"❌ Ошибка создания дефолтного tenant: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🔄 Создание таблиц...")
    create_tables()
    
    print("🔄 Создание дефолтного tenant...")
    create_default_tenant()
    print("✅ Готово!") 