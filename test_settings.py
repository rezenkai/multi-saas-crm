import requests
import json

# Конфигурация
BASE_URL = "http://localhost:8000"
EMAIL = "testcontacts@example.com"
PASSWORD = "TestPassword123!"
TENANT_ID = "fbcc1f5e-f93b-48c8-9779-5ea1a92ec028"  # ID дефолтного tenant

def register():
    """Регистрация нового пользователя"""
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/register",
        json={
            "email": EMAIL,
            "password": PASSWORD,
            "password_confirm": PASSWORD,
            "first_name": "Test",
            "last_name": "User"
        }
    )
    print("Register response:", response.text)
    return response.json()

def login():
    """Вход в систему"""
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={
            "email": EMAIL,
            "password": PASSWORD,
            "tenant_id": TENANT_ID
        }
    )
    print("Login response:", response.text)
    return response.json()["access_token"]

def get_settings(token):
    """Получение настроек пользователя"""
    response = requests.get(
        f"{BASE_URL}/api/v1/users/settings",
        headers={
            "Authorization": f"Bearer {token}"
        }
    )
    print("Settings response:", response.text)
    return response.json()

def update_settings(token, settings):
    """Обновление настроек пользователя"""
    response = requests.put(
        f"{BASE_URL}/api/v1/users/settings",
        headers={
            "Authorization": f"Bearer {token}"
        },
        json=settings
    )
    print("Update settings response:", response.text)
    return response.json()

def main():
    # Регистрация нового пользователя
    print("\nRegistering new user...")
    register_result = register()

    # Вход в систему
    print("\nLogging in...")
    token = login()
    print("\nAccess token:", token)

    # Получение текущих настроек
    print("\nGetting current settings...")
    current_settings = get_settings(token)

    # Обновление настроек
    new_settings = {
        "theme": "dark",
        "locale": "ru",
        "timezone": "Europe/Moscow",
        "email_notifications": True,
        "sms_notifications": False,
        "push_notifications": True,
        "marketing_notifications": False
    }
    print("\nUpdating settings...")
    update_result = update_settings(token, new_settings)

    # Проверка обновленных настроек
    print("\nGetting updated settings...")
    updated_settings = get_settings(token)

if __name__ == "__main__":
    main() 