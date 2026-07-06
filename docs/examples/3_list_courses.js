// Fetch API example (works in Node.js 18+ and browsers)
async function listCourses() {
  try {
    const response = await fetch('http://localhost:3000/courses', {
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
listCourses();