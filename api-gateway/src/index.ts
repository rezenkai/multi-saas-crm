import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { authMiddleware } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';
import { loggingMiddleware } from './middleware/logging';
import { errorHandler } from './middleware/errorHandler';
import { serviceRegistry } from './services/serviceRegistry';
import { healthCheck } from './routes/health';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Custom middleware
app.use(loggingMiddleware);
app.use(tenantMiddleware);

// Health check endpoint
app.use('/health', healthCheck);

// Direct health check routes for testing (without authentication)
app.use('/api/plugins', createProxyMiddleware({
  target: serviceRegistry.getService('plugins').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/plugins': '',
  },
  onError: (err, req, res) => {
    logger.error('Plugins service proxy error:', err);
    res.status(503).json({ error: 'Plugins service unavailable' });
  },
}));

app.use('/api/erp', createProxyMiddleware({
  target: serviceRegistry.getService('erp').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/erp': '',
  },
  onError: (err, req, res) => {
    logger.error('ERP service proxy error:', err);
    res.status(503).json({ error: 'ERP service unavailable' });
  },
}));

app.use('/api/marketing', createProxyMiddleware({
  target: serviceRegistry.getService('marketing').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/marketing': '',
  },
  onError: (err, req, res) => {
    logger.error('Marketing service proxy error:', err);
    res.status(503).json({ error: 'Marketing service unavailable' });
  },
}));

app.use('/api/customfields', createProxyMiddleware({
  target: serviceRegistry.getService('customfields').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/customfields': '',
  },
  onError: (err, req, res) => {
    logger.error('Custom Fields service proxy error:', err);
    res.status(503).json({ error: 'Custom Fields service unavailable' });
  },
}));

// OAuth2 Service routes (public endpoints)
app.use('/oauth', createProxyMiddleware({
  target: serviceRegistry.getService('oauth2').url,
  changeOrigin: true,
  pathRewrite: {
    '^/oauth': '/oauth',
  },
  onError: (err, req, res) => {
    logger.error('OAuth2 service proxy error:', err);
    res.status(503).json({ error: 'OAuth2 service unavailable' });
  },
}));

app.use('/auth', createProxyMiddleware({
  target: serviceRegistry.getService('oauth2').url,
  changeOrigin: true,
  pathRewrite: {
    '^/auth': '/auth',
  },
  onError: (err, req, res) => {
    logger.error('OAuth2 auth proxy error:', err);
    res.status(503).json({ error: 'OAuth2 auth service unavailable' });
  },
}));

// OAuth2 discovery endpoints
app.use('/.well-known', createProxyMiddleware({
  target: serviceRegistry.getService('oauth2').url,
  changeOrigin: true,
  pathRewrite: {
    '^/.well-known': '/.well-known',
  },
  onError: (err, req, res) => {
    logger.error('OAuth2 discovery proxy error:', err);
    res.status(503).json({ error: 'OAuth2 discovery unavailable' });
  },
}));

// Workflow Engine routes (authenticated endpoints)
app.use('/api/workflows', createProxyMiddleware({
  target: serviceRegistry.getService('workflow').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/workflows': '/api/workflows',
  },
  onError: (err, req, res) => {
    logger.error('Workflow engine proxy error:', err);
    res.status(503).json({ error: 'Workflow engine service unavailable' });
  },
}));

app.use('/api/builder', createProxyMiddleware({
  target: serviceRegistry.getService('workflow').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/builder': '/api/builder',
  },
  onError: (err, req, res) => {
    logger.error('Workflow builder proxy error:', err);
    res.status(503).json({ error: 'Workflow builder service unavailable' });
  },
}));

// API Gateway routes with authentication
app.use('/api/v1/auth', createProxyMiddleware({
  target: serviceRegistry.getService('auth').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/auth': '/api/v1',
  },
  onError: (err, req, res) => {
    logger.error('Auth service proxy error:', err);
    res.status(503).json({ error: 'Auth service unavailable' });
  },
}));

// Protected routes - require authentication
app.use('/api/v1/users', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.getService('users').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/users': '/api/v1',
  },
  onError: (err, req, res) => {
    logger.error('Users service proxy error:', err);
    res.status(503).json({ error: 'Users service unavailable' });
  },
}));

app.use('/api/v1/contacts', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.getService('contacts').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/contacts': '/api/v1',
  },
  onError: (err, req, res) => {
    logger.error('Contacts service proxy error:', err);
    res.status(503).json({ error: 'Contacts service unavailable' });
  },
}));

app.use('/api/v1/companies', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.getService('companies').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/companies': '/api/v1',
  },
  onError: (err, req, res) => {
    logger.error('Companies service proxy error:', err);
    res.status(503).json({ error: 'Companies service unavailable' });
  },
}));

app.use('/api/v1/opportunities', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.getService('opportunities').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/opportunities': '/api/v1',
  },
  onError: (err, req, res) => {
    logger.error('Opportunities service proxy error:', err);
    res.status(503).json({ error: 'Opportunities service unavailable' });
  },
}));

app.use('/api/v1/dashboard', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.getService('dashboard').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/dashboard': '/api/v1',
  },
  onError: (err, req, res) => {
    logger.error('Dashboard service proxy error:', err);
    res.status(503).json({ error: 'Dashboard service unavailable' });
  },
}));

// Future modules
app.use('/api/v1/erp', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.getService('erp').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/erp': '/api/v1',
  },
  onError: (err, req, res) => {
    logger.error('ERP service proxy error:', err);
    res.status(503).json({ error: 'ERP service unavailable' });
  },
}));

app.use('/api/v1/marketing', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.getService('marketing').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/marketing': '/api/v1',
  },
  onError: (err, req, res) => {
    logger.error('Marketing service proxy error:', err);
    res.status(503).json({ error: 'Marketing service unavailable' });
  },
}));

// Plugin system routes
app.use('/api/v1/plugins', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.getService('plugins').url,
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/plugins': '/api/v1',
  },
  onError: (err, req, res) => {
    logger.error('Plugins service proxy error:', err);
    res.status(503).json({ error: 'Plugins service unavailable' });
  },
}));

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const PORT = config.port || 3001;
app.listen(PORT, () => {
  logger.info(`API Gateway started on port ${PORT}`);
  logger.info(`Environment: ${config.environment}`);
  logger.info('Services:', serviceRegistry.listServices());
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