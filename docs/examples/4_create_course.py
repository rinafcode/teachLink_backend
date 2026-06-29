import requests
import json

def create_course():
    url = "http://localhost:3000/courses"
  headers = {
      'Authorization': f'Bearer {access_token}',
  }
    
    data = {
        "title": "Advanced TypeScript",
        "description": "Master TypeScript type system and advanced patterns.",
        "category": "programming",
        "level": "advanced",
        "price": 5999
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
    create_course()