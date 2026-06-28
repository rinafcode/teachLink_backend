// Fetch API example (works in Node.js 18+ and browsers)
async function createPaymentIntent() {
  try {
    const response = await fetch('http://localhost:3000/payments/create-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
      },
      body: JSON.stringify({"courseId":"8e4fd4f8-d8f3-46b5-8786-6f7167a654f4","amount":3999,"currency":"USD"}),
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
createPaymentIntent();