import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'custom-fields-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Basic API endpoints for testing
app.get('/api/v1/fields/:entityType', (req, res) => {
  const { entityType } = req.params;
  res.json({ 
    entityType,
    fields: [],
    message: 'Custom Fields Service is running - basic implementation'
  });
});

app.post('/api/v1/fields', (req, res) => {
  res.json({ 
    success: true,
    field: { id: 'test-field', ...req.body },
    message: 'Field creation placeholder'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const PORT = process.env.PORT || 8009;
app.listen(PORT, () => {
  console.log(`Custom Fields Service started on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});