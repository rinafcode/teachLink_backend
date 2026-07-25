const endpoints = [
    '/health',
    '/health/live',
    '/health/ready',
  ];
  
  async function run() {
    const baseUrl = process.env.APP_URL;
  
    for (const endpoint of endpoints) {
      const response = await fetch(
        `${baseUrl}${endpoint}`,
      );
  
      if (!response.ok) {
        throw new Error(
          `Health check failed: ${endpoint}`,
        );
      }
    }
  
    console.log('All health checks passed');
  }
  
  run();