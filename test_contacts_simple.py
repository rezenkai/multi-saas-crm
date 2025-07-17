import requests
import json

BASE_URL = "http://localhost:8000/api/v1"
CONTACTS_URL = f"{BASE_URL}/contacts"

def test_contacts_direct():
    """Прямое тестирование API контактов"""
    
    # 1. Создание контакта (без аутентификации для тестирования)
    contact_data = {
        "first_name": "Иван",
        "last_name": "Иванов",
        "email": "ivan@example.com",
        "phone": "+7-999-123-45-67",
        "contact_type": "lead",
        "title": "Менеджер",
        "notes": "Потенциальный клиент"
    }
    
    # Пока отключим аутентификацию для тестирования
    print("Testing contacts API...")
    print("Contact data:", contact_data)
    
    # Проверим, что сервер отвечает
    try:
        resp = requests.get("http://localhost:8000/health")
        print("Health check:", resp.status_code, resp.json())
    except Exception as e:
        print("Server not responding:", e)
        return

if __name__ == "__main__":
    test_contacts_direct() 