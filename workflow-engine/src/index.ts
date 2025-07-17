import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { WorkflowEngine } from './core/WorkflowEngine';

// Import routes
import workflowRoutes from './routes/workflows';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: config.security.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Request-ID']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindow,
  max: config.security.rateLimitMax,
  message: {
    error: 'too_many_requests',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req: any, res, next) => {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;
  
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId,
    tenantId: req.headers['x-tenant-id']
  });
  
  res.setHeader('X-Request-ID', requestId);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'workflow-engine',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.environment,
    features: {
      workflow_builder: true,
      automation_engine: true,
      no_code_constructor: true,
      event_triggers: true,
      webhook_support: config.workflow.enableWebhooks,
      scheduled_workflows: config.workflow.enableScheduling,
      external_integrations: config.integrations.enableExternalAPIs
    }
  });
});

// API routes
app.use('/api/workflows', workflowRoutes);

// Workflow Builder endpoints
app.get('/api/builder/components', (req, res) => {
  res.json({
    triggers: [
      {
        type: 'event',
        name: 'System Event',
        description: 'Trigger when a system event occurs',
        icon: 'event',
        config: {
          eventSource: { type: 'select', options: ['crm', 'erp', 'marketing', 'custom'] },
          eventType: { type: 'text', placeholder: 'e.g., lead_created' }
        }
      },
      {
        type: 'webhook',
        name: 'Webhook',
        description: 'Trigger via HTTP webhook',
        icon: 'webhook',
        config: {
          webhookUrl: { type: 'text', placeholder: 'Auto-generated' },
          webhookMethod: { type: 'select', options: ['POST', 'GET', 'PUT'] }
        }
      },
      {
        type: 'schedule',
        name: 'Schedule',
        description: 'Trigger on a schedule',
        icon: 'schedule',
        config: {
          cron: { type: 'text', placeholder: '0 9 * * *' },
          timezone: { type: 'select', options: ['UTC', 'America/New_York', 'Europe/London'] }
        }
      }
    ],
    steps: [
      {
        type: 'send_email',
        name: 'Send Email',
        description: 'Send an email message',
        icon: 'email',
        category: 'communication',
        config: {
          to: { type: 'text', placeholder: 'recipient@example.com' },
          subject: { type: 'text', placeholder: 'Email subject' },
          htmlBody: { type: 'textarea', placeholder: 'Email content' }
        }
      },
      {
        type: 'api_call',
        name: 'API Call',
        description: 'Make an HTTP API call',
        icon: 'api',
        category: 'integration',
        config: {
          url: { type: 'text', placeholder: 'https://api.example.com' },
          method: { type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] },
          headers: { type: 'object', placeholder: '{"Content-Type": "application/json"}' },
          body: { type: 'textarea', placeholder: 'Request body' }
        }
      },
      {
        type: 'create_contact',
        name: 'Create Contact',
        description: 'Create a new contact in CRM',
        icon: 'contact',
        category: 'crm',
        config: {
          firstName: { type: 'text', placeholder: 'First name' },
          lastName: { type: 'text', placeholder: 'Last name' },
          email: { type: 'text', placeholder: 'Email address' },
          phone: { type: 'text', placeholder: 'Phone number' }
        }
      },
      {
        type: 'create_deal',
        name: 'Create Deal',
        description: 'Create a new deal in CRM',
        icon: 'deal',
        category: 'crm',
        config: {
          name: { type: 'text', placeholder: 'Deal name' },
          value: { type: 'number', placeholder: 'Deal value' },
          stage: { type: 'select', options: ['prospect', 'qualified', 'proposal', 'negotiation', 'closed'] },
          contactId: { type: 'text', placeholder: 'Contact ID' }
        }
      },
      {
        type: 'condition',
        name: 'Condition',
        description: 'Conditional logic branch',
        icon: 'condition',
        category: 'logic',
        config: {
          expression: { type: 'text', placeholder: 'condition expression' },
          trueSteps: { type: 'array', placeholder: 'Steps to execute if true' },
          falseSteps: { type: 'array', placeholder: 'Steps to execute if false' }
        }
      },
      {
        type: 'wait',
        name: 'Wait',
        description: 'Wait for a specified time',
        icon: 'wait',
        category: 'utility',
        config: {
          waitType: { type: 'select', options: ['fixed', 'until_condition'] },
          waitDuration: { type: 'number', placeholder: 'Duration in milliseconds' }
        }
      }
    ],
    conditions: [
      {
        operator: 'equals',
        name: 'Equals',
        description: 'Field equals value'
      },
      {
        operator: 'contains',
        name: 'Contains',
        description: 'Field contains value'
      },
      {
        operator: 'greater_than',
        name: 'Greater Than',
        description: 'Field is greater than value'
      },
      {
        operator: 'less_than',
        name: 'Less Than',
        description: 'Field is less than value'
      }
    ]
  });
});

// Workflow validation endpoint
app.post('/api/builder/validate', (req, res) => {
  const { workflow } = req.body;
  
  const errors: any[] = [];
  const warnings: any[] = [];
  
  // Basic validation
  if (!workflow.name) {
    errors.push({ field: 'name', message: 'Workflow name is required' });
  }
  
  if (!workflow.triggers || workflow.triggers.length === 0) {
    errors.push({ field: 'triggers', message: 'At least one trigger is required' });
  }
  
  if (!workflow.steps || workflow.steps.length === 0) {
    errors.push({ field: 'steps', message: 'At least one step is required' });
  }
  
  // Validate triggers
  if (workflow.triggers) {
    workflow.triggers.forEach((trigger: any, index: number) => {
      if (!trigger.type) {
        errors.push({ field: `triggers[${index}].type`, message: 'Trigger type is required' });
      }
      if (!trigger.name) {
        errors.push({ field: `triggers[${index}].name`, message: 'Trigger name is required' });
      }
    });
  }
  
  // Validate steps
  if (workflow.steps) {
    workflow.steps.forEach((step: any, index: number) => {
      if (!step.type) {
        errors.push({ field: `steps[${index}].type`, message: 'Step type is required' });
      }
      if (!step.name) {
        errors.push({ field: `steps[${index}].name`, message: 'Step name is required' });
      }
      if (step.position === undefined) {
        errors.push({ field: `steps[${index}].position`, message: 'Step position is required' });
      }
    });
  }
  
  res.json({
    isValid: errors.length === 0,
    errors,
    warnings
  });
});

// Error handling middleware
app.use((err: Error, req: any, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    path: req.path,
    method: req.method
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: config.environment === 'development' ? err.message : 'Something went wrong',
    requestId: req.requestId
  });
});

// 404 handler
app.use((req: any, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    requestId: req.requestId
  });
});

// Initialize workflow engine
const workflowEngine = new WorkflowEngine();

// Start server
const PORT = config.port || 8011;
app.listen(PORT, async () => {
  logger.info(`Workflow Engine started on port ${PORT}`, {
    environment: config.environment,
    features: {
      webhooks: config.workflow.enableWebhooks,
      scheduling: config.workflow.enableScheduling,
      externalAPIs: config.integrations.enableExternalAPIs
    }
  });
  
  // Start workflow engine
  await workflowEngine.start();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await workflowEngine.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await workflowEngine.stop();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

export default app;