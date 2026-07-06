import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

async function createCourse() {
  try {
    const response = await apiClient.post('/courses', {"title":"Advanced TypeScript","description":"Master TypeScript type system and advanced patterns.","category":"programming","level":"advanced","price":5999},
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
createCourse();