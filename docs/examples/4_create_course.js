// Fetch API example (works in Node.js 18+ and browsers)
async function createCourse() {
  try {
    const response = await fetch('http://localhost:3000/courses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
      },
      body: JSON.stringify({"title":"Advanced TypeScript","description":"Master TypeScript type system and advanced patterns.","category":"programming","level":"advanced","price":5999}),
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
createCourse();