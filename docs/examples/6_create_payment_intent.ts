import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

async function createPaymentIntent() {
  try {
    const response = await apiClient.post('/payments/create-intent', {"courseId":"8e4fd4f8-d8f3-46b5-8786-6f7167a654f4","amount":3999,"currency":"USD"},
    {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
    });
    
    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Usage
createPaymentIntent();