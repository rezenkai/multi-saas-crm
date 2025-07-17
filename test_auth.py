import requests

BASE_URL = "http://localhost:8000/api/v1/auth"

def test_register():
    data = {
        "email": "testuser@example.com",
        "password": "TestPass123!",
        "password_confirm": "TestPass123!",
        "first_name": "Test",
        "last_name": "User"
    }
    resp = requests.post(f"{BASE_URL}/register", json=data)
    print("Register:", resp.status_code, resp.json())

def test_login():
    data = {
        "email": "testuser@example.com",
        "password": "TestPass123!"
    }
    resp = requests.post(f"{BASE_URL}/login", json=data)
    print("Login:", resp.status_code, resp.json())

if __name__ == "__main__":
    test_register()
    test_login() 