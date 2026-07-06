import requests
import json

def register():
    url = "http://localhost:3000/auth/register"
    
    data = {
        "email": "newuser@example.com",
        "password": "SecurePass123!",
        "firstName": "Grace",
        "lastName": "Hopper",
        "role": "student"
    }
    
    try:
        response = requests.post(url, json=data)
        response.raise_for_status()
        print("Response:", response.json())
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return None

# Usage
if __name__ == "__main__":
    register()