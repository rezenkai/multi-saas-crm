const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 8003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'plugins-system',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Mock plugins endpoint
app.get('/api/v1/plugins', (req, res) => {
  res.json({
    plugins: [
      {
        id: 'sample-crm-extension',
        name: 'Sample CRM Extension',
        version: '1.0.0',
        status: 'active',
        description: 'A sample plugin for testing',
        author: 'Multi-SaaS Team'
      }
    ],
    total: 1,
    active: 1,
    inactive: 0
  });
});

// Mock marketplace endpoint
app.get('/api/v1/marketplace', (req, res) => {
  res.json({
    plugins: [
      {
        id: 'sample-crm-extension',
        name: 'Sample CRM Extension',
        description: 'A sample plugin demonstrating CRM integration capabilities',
        version: '1.0.0',
        author: 'Multi-SaaS Team',
        category: 'productivity',
        price: 0,
        rating: 4.5,
        reviews: 12,
        downloads: 150
      }
    ],
    total: 1,
    page: 1,
    perPage: 10
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Plugins System (Simple) started on port ${PORT}`);
});

module.exports = app;