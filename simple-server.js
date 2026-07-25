const express = require('express');
const app = express();
const moderationRoutes = require('./moderation.routes');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount the moderation and queue APIs
app.use('/api/moderation', moderationRoutes);

// Basic health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'TeachLink API is running', 
    timestamp: new Date().toISOString(),
    status: 'OK'
  });
});

// Basic API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'TeachLink API',
    version: '1.0.0',
    status: 'Running',
    endpoints: ['/', '/api', '/health']
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📚 API available at http://localhost:${PORT}/api`);
  console.log(`🏥 Health check at http://localhost:${PORT}/health`);
});
