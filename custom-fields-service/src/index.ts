import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { authMiddleware } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';
import { errorHandler } from './middleware/errorHandler';
import { CustomFieldsManager } from './core/CustomFieldsManager';
import { MetadataService } from './services/MetadataService';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Custom middleware
app.use(tenantMiddleware);

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

// Initialize services
const customFieldsManager = new CustomFieldsManager();
const metadataService = new MetadataService();

// Routes

// Get all custom fields for an entity
app.get('/api/v1/fields/:entityType', authMiddleware, async (req, res) => {
  try {
    const { entityType } = req.params;
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }
    
    const fields = await customFieldsManager.getFieldsForEntity(tenantId, entityType);
    res.json({ fields });
  } catch (error) {
    logger.error('Error fetching custom fields:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new custom field
app.post('/api/v1/fields', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const userId = req.user?.id;
    
    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Tenant ID and User ID are required' });
    }
    
    const fieldData = req.body;
    const field = await customFieldsManager.createField(tenantId, userId, fieldData);
    
    res.status(201).json({ field });
  } catch (error) {
    logger.error('Error creating custom field:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a custom field
app.put('/api/v1/fields/:fieldId', authMiddleware, async (req, res) => {
  try {
    const { fieldId } = req.params;
    const tenantId = req.tenant?.id;
    const userId = req.user?.id;
    
    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Tenant ID and User ID are required' });
    }
    
    const updates = req.body;
    const field = await customFieldsManager.updateField(tenantId, fieldId, userId, updates);
    
    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }
    
    res.json({ field });
  } catch (error) {
    logger.error('Error updating custom field:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a custom field
app.delete('/api/v1/fields/:fieldId', authMiddleware, async (req, res) => {
  try {
    const { fieldId } = req.params;
    const tenantId = req.tenant?.id;
    const userId = req.user?.id;
    
    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Tenant ID and User ID are required' });
    }
    
    const deleted = await customFieldsManager.deleteField(tenantId, fieldId, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Field not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting custom field:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get metadata for an entity (including custom fields)
app.get('/api/v1/metadata/:entityType', authMiddleware, async (req, res) => {
  try {
    const { entityType } = req.params;
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }
    
    const metadata = await metadataService.getEntitySchema(tenantId, entityType);
    res.json({ metadata });
  } catch (error) {
    logger.error('Error fetching metadata:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get/Set custom field values for a record
app.get('/api/v1/data/:entityType/:recordId', authMiddleware, async (req, res) => {
  try {
    const { entityType, recordId } = req.params;
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }
    
    const data = await customFieldsManager.getFieldValues(tenantId, entityType, recordId);
    res.json({ data });
  } catch (error) {
    logger.error('Error fetching field values:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/v1/data/:entityType/:recordId', authMiddleware, async (req, res) => {
  try {
    const { entityType, recordId } = req.params;
    const tenantId = req.tenant?.id;
    const userId = req.user?.id;
    
    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Tenant ID and User ID are required' });
    }
    
    const fieldValues = req.body;
    const result = await customFieldsManager.setFieldValues(tenantId, entityType, recordId, fieldValues, userId);
    
    res.json({ result });
  } catch (error) {
    logger.error('Error setting field values:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const PORT = config.port || 8009;
app.listen(PORT, () => {
  logger.info(`Custom Fields Service started on port ${PORT}`);
  logger.info(`Environment: ${config.environment}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});