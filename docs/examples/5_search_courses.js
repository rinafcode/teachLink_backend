// Fetch API example (works in Node.js 18+ and browsers)
async function searchCourses() {
  try {
    const response = await fetch('http://localhost:3000/search', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Response:', data);
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage
searchCourses();