import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

async function register() {
  try {
    const response = await apiClient.post('/auth/register', {"email":"newuser@example.com","password":"SecurePass123!","firstName":"Grace","lastName":"Hopper","role":"student"});
    
    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Usage
register();