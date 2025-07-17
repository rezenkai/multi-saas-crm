#!/usr/bin/env python3
"""
Скрипт для создания таблиц в базе данных
"""
import sys
import os

# Добавляем путь к backend в sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.database import create_tables, engine
from app.models import user, tenant, contact, company
from app.core.config import settings

def main():
    print("Создание таблиц в базе данных...")
    print(f"📊 DATABASE_URL: {settings.DATABASE_URL}")
    
    try:
        # Создаем таблицы
        create_tables()
        print("✅ Таблицы успешно созданы!")
        
        # Проверяем, что файл базы данных создался
        db_file = "backend/salesforce_clone.db"
        if os.path.exists(db_file):
            size = os.path.getsize(db_file)
            print(f"📁 Файл базы данных: {db_file}")
            print(f"📊 Размер файла: {size} байт")
        else:
            print("❌ Файл базы данных не найден")
            
    except Exception as e:
        print(f"❌ Ошибка при создании таблиц: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 