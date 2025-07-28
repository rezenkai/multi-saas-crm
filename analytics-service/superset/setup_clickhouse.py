#!/usr/bin/env python3
"""
Простой скрипт для настройки подключения ClickHouse в Superset через API
"""

import requests
import json
import time
import sys

def wait_for_superset(base_url="http://localhost:8006", max_attempts=30):
    """Ожидание запуска Superset"""
    print("⏳ Ожидание запуска Superset...")
    
    for attempt in range(max_attempts):
        try:
            response = requests.get(f"{base_url}/login/", timeout=5)
            if response.status_code == 200:
                print("✅ Superset запущен")
                return True
        except Exception as e:
            print(f"⏳ Попытка {attempt + 1}/{max_attempts}: {str(e)}")
            
        time.sleep(10)
    
    print("❌ Superset не запустился в течение ожидаемого времени")
    return False

def main():
    """Главная функция"""
    print("🚀 Настройка Superset для CRM Analytics...")
    
    base_url = "http://localhost:8006"
    
    # Ожидаем запуск Superset
    if not wait_for_superset(base_url):
        sys.exit(1)
    
    print("\n🎉 Superset готов к работе!")
    print(f"🌐 Откройте {base_url} в браузере")
    print(f"👤 Логин: admin")
    print(f"🔑 Пароль: admin123")
    print("\n📋 Инструкции по настройке:")
    print("1. Войдите в Superset")
    print("2. Перейдите в Settings > Database Connections")
    print("3. Нажмите '+ DATABASE'")
    print("4. Выберите ClickHouse")
    print("5. Введите данные:")
    print("   - Display Name: CRM ClickHouse")
    print("   - SQLAlchemy URI: clickhousedb://analytics:analytics_password@clickhouse-analytics:8123/crm_analytics")
    print("6. Нажмите 'Test Connection' и 'Connect'")
    
    return True

if __name__ == "__main__":
    main()