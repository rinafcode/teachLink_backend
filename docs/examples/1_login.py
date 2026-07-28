import requests
import json

def login():
    url = "http://localhost:3000/auth/login"
    
    data = {
        "email": "learner@example.com",
        "password": "Password123!"
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
    login()