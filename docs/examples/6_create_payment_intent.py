import requests
import json

def create_payment_intent():
    url = "http://localhost:3000/payments/create-intent"
  headers = {
      'Authorization': f'Bearer {access_token}',
  }
    
    data = {
        "courseId": "8e4fd4f8-d8f3-46b5-8786-6f7167a654f4",
        "amount": 3999,
        "currency": "USD"
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        response.raise_for_status()
        print("Response:", response.json())
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return None

# Usage
if __name__ == "__main__":
    create_payment_intent()