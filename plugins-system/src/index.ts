import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import path from 'path';
import { config } from './config';
import { logger } from './utils/logger';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { PluginManager } from './core/PluginManager';
import { pluginRoutes } from './routes/plugins';
import { marketplaceRoutes } from './routes/marketplace';
import { healthRoutes } from './routes/health';

const app = express();

// Initialize Plugin Manager
const pluginManager = new PluginManager();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Request parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.zip', '.tar.gz', '.tgz'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only zip and tar.gz files are allowed.'));
    }
  }
});

// Make plugin manager available to routes
app.locals.pluginManager = pluginManager;

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/plugins', authMiddleware, pluginRoutes);
app.use('/api/v1/marketplace', authMiddleware, marketplaceRoutes);

// Plugin upload endpoint
app.post('/api/v1/plugins/upload', 
  authMiddleware, 
  upload.single('plugin'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const userId = req.headers['x-user-id'] as string;
      const tenantId = req.headers['x-tenant-id'] as string;

      const result = await pluginManager.installPlugin(
        req.file.path,
        userId,
        tenantId
      );

      res.json({
        message: 'Plugin uploaded and installed successfully',
        plugin: result
      });
    } catch (error) {
      logger.error('Plugin upload error:', error);
      res.status(500).json({ 
        error: 'Plugin upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Static files for plugin assets
app.use('/assets', express.static(path.join(__dirname, '../plugins')));

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize plugins on startup
pluginManager.initialize().then(() => {
  logger.info('Plugin manager initialized');
}).catch(error => {
  logger.error('Failed to initialize plugin manager:', error);
});

// Start server
const PORT = config.port || 8003;
app.listen(PORT, () => {
  logger.info(`Plugin System started on port ${PORT}`);
  logger.info(`Environment: ${config.environment}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await pluginManager.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await pluginManager.shutdown();
  process.exit(0);
});