import requests
import json

def list_courses():
    url = "http://localhost:3000/courses"
    
    data = None
    
    try:
        response = requests.get(url, json=data)
        response.raise_for_status()
        print("Response:", response.json())
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return None

# Usage
if __name__ == "__main__":
    list_courses()