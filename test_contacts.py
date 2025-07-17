import requests
import json

BASE_URL = "http://localhost:8000/api/v1"
AUTH_URL = f"{BASE_URL}/auth"
CONTACTS_URL = f"{BASE_URL}/contacts"

def get_auth_token():
    """Получение токена аутентификации"""
    # Сначала регистрируемся
    register_data = {
        "email": "testuser2@example.com",
        "password": "TestPass123!",
        "password_confirm": "TestPass123!",
        "first_name": "Test",
        "last_name": "User"
    }
    
    resp = requests.post(f"{AUTH_URL}/register", json=register_data)
    print("Register:", resp.status_code)
    
    # Затем логинимся
    login_data = {
        "email": "testuser2@example.com",
        "password": "TestPass123!"
    }
    
    resp = requests.post(f"{AUTH_URL}/login", json=login_data)
    print("Login:", resp.status_code, resp.json())
    
    if resp.status_code == 200:
        return resp.json()["access_token"]
    return None

def test_contacts_api():
    """Тестирование API контактов"""
    # Получаем токен
    token = get_auth_token()
    if not token:
        print("❌ Не удалось получить токен аутентификации")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Создание контакта
    contact_data = {
        "first_name": "Иван",
        "last_name": "Иванов",
        "email": "ivan@example.com",
        "phone": "+7-999-123-45-67",
        "contact_type": "lead",
        "title": "Менеджер",
        "company": "ООО Рога и Копыта",
        "notes": "Потенциальный клиент"
    }
    
    resp = requests.post(f"{CONTACTS_URL}/", json=contact_data, headers=headers)
    print("Create contact:", resp.status_code, resp.json())
    
    if resp.status_code == 201:
        contact_id = resp.json()["id"]
        
        # 2. Получение списка контактов
        resp = requests.get(f"{CONTACTS_URL}/", headers=headers)
        print("Get contacts:", resp.status_code, resp.json())
        
        # 3. Получение конкретного контакта
        resp = requests.get(f"{CONTACTS_URL}/{contact_id}", headers=headers)
        print("Get contact:", resp.status_code, resp.json())
        
        # 4. Обновление контакта
        update_data = {
            "phone": "+7-999-987-65-43",
            "notes": "Обновленная заметка"
        }
        resp = requests.put(f"{CONTACTS_URL}/{contact_id}", json=update_data, headers=headers)
        print("Update contact:", resp.status_code, resp.json())
        
        # 5. Создание заметки о контакте
        note_data = {
            "title": "Первый звонок",
            "content": "Клиент заинтересован в продукте",
            "note_type": "call"
        }
        resp = requests.post(f"{CONTACTS_URL}/{contact_id}/notes", json=note_data, headers=headers)
        print("Create note:", resp.status_code, resp.json())
        
        # 6. Удаление контакта
        resp = requests.delete(f"{CONTACTS_URL}/{contact_id}", headers=headers)
        print("Delete contact:", resp.status_code)

if __name__ == "__main__":
    test_contacts_api() 