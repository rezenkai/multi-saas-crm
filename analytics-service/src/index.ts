import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import { logger, requestLogger } from './utils/logger';

import { config } from './config';
import { checkDatabaseConnection, runMigrations, closeDatabaseConnection } from './config/database';
import { EventService } from './services/EventService';
import { MetricsService } from './services/MetricsService';
import { ClickHouseService } from './services/ClickHouseService';

// Routes
import { eventRoutes } from './controllers/EventController';
import { dashboardRoutes } from './controllers/DashboardController';
import { hybridAnalyticsRoutes } from './controllers/HybridAnalyticsController';
import { healthRoutes } from './controllers/HealthController';
import { crmAnalyticsRoutes } from './controllers/CrmAnalyticsRoutes';

class AnalyticsServer {
  private app: express.Application;
  private server: any;
  private wss?: WebSocketServer;
  private eventService: EventService;
  private metricsService: MetricsService;
  private clickHouseService: ClickHouseService;

  constructor() {
    this.app = express();
    this.eventService = new EventService();
    this.metricsService = new MetricsService();
    this.clickHouseService = new ClickHouseService();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupGracefulShutdown();
  }

  private setupMiddleware(): void {
    // Security middleware
    if (config.security.enableHelmet) {
      this.app.use(helmet({
        contentSecurityPolicy: false, // Disable CSP for API
      }));
    }

    // CORS
    if (config.security.enableCors) {
      this.app.use(cors({
        origin: config.security.corsOrigin === '*' 
          ? true 
          : config.security.corsOrigin.split(',').map(origin => origin.trim()),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID']
      }));
    }

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging with file output
    this.app.use(requestLogger);

    // Rate limiting (simple implementation)
    const requestCounts = new Map<string, {count: number, resetTime: number}>();
    this.app.use((req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      const windowMs = config.security.rateLimitWindow;
      
      const current = requestCounts.get(ip) || {count: 0, resetTime: now + windowMs};
      
      if (now > current.resetTime) {
        current.count = 0;
        current.resetTime = now + windowMs;
      }
      
      current.count++;
      requestCounts.set(ip, current);
      
      if (current.count > config.security.rateLimitRequests) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((current.resetTime - now) / 1000)
        });
      }
      
      next();
    });
  }

  private setupRoutes(): void {
    // Health check (no auth required)
    this.app.use('/health', healthRoutes);

    // API routes
    this.app.use('/api/events', eventRoutes(this.eventService));
    this.app.use('/api/dashboard', dashboardRoutes(this.metricsService));
    this.app.use('/api/hybrid', hybridAnalyticsRoutes(this.metricsService));
    this.app.use('/api/crm', crmAnalyticsRoutes());

    // API documentation
    this.app.get('/api/docs', (req, res) => {
      res.json({
        name: 'CRM Analytics Service',
        version: '1.0.0',
        description: 'Free analytics service with Apache Superset, ClickHouse and PostgreSQL',
        endpoints: {
          'GET /health': 'Service health check',
          'POST /api/events/track': 'Track single event',
          'POST /api/events/batch': 'Track multiple events',
          'GET /api/events/user/:userId': 'Get user events',
          'GET /api/dashboard/sales': 'Get sales metrics',
          'GET /api/dashboard/funnel': 'Get sales funnel metrics',
          'GET /api/dashboard/users': 'Get user activity metrics',
          'GET /api/dashboard/summary': 'Get dashboard summary',
          'GET /api/dashboard/realtime': 'Get real-time metrics',
          'GET /api/hybrid/dashboard': 'Unified CRM + Superset dashboard',
          'GET /api/hybrid/reports/builder': 'Report builder interface',
          'POST /api/hybrid/reports/create': 'Create custom reports',
          'GET /api/hybrid/export/:format': 'Export reports (CSV/PDF/JSON)',
          'GET /api/crm/sales-by-month': 'Объем продаж по месяцам',
          'GET /api/crm/manager-activity': 'Активность менеджеров',
          'GET /api/crm/leads-by-source': 'Лиды по источникам',
          'GET /api/crm/lead-conversion': 'Конверсия лидов в сделки',
          'GET /api/crm/sales-funnel': 'Воронка продаж',
          'GET /api/crm/reports': 'Список доступных отчетов',
          'POST /api/crm/export': 'Экспорт отчетов'
        },
        configuration: {
          database: config.database.database,
          redis_enabled: !!config.redis.host,
          superset_enabled: true,
          clickhouse_enabled: true,
          batch_size: config.analytics.batchSize,
          flush_interval: config.analytics.flushInterval
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        availableRoutes: ['/health', '/api/docs', '/api/events/*', '/api/dashboard/*']
      });
    });

    // Error handler with logging
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const context = (req as any).context;
      
      logger.error('Unhandled application error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        query: req.query,
        headers: req.headers
      }, context);
      
      res.status(error.status || 500).json({
        error: error.name || 'Internal Server Error',
        message: config.nodeEnv === 'production' 
          ? 'An unexpected error occurred' 
          : error.message,
        ...(config.nodeEnv === 'development' && { stack: error.stack }),
        ...(context?.requestId && { requestId: context.requestId })
      });
    });
  }

  private setupWebSocket(): void {
    if (!config.analytics.enableRealTime) {
      console.log('⚠️  WebSocket disabled by configuration');
      return;
    }

    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws'
    });

    this.wss.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress;
      console.log(`🔌 WebSocket client connected from ${ip}`);
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to CRM Analytics WebSocket',
        timestamp: new Date()
      }));

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('📨 WebSocket message received:', data);
          
          // Handle different message types
          if (data.type === 'subscribe' && data.tenantId) {
            // TODO: Implement tenant-specific subscriptions
            ws.send(JSON.stringify({
              type: 'subscribed',
              tenantId: data.tenantId,
              timestamp: new Date()
            }));
          }
        } catch (error) {
          console.error('❌ WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
            timestamp: new Date()
          }));
        }
      });

      ws.on('close', () => {
        console.log(`🔌 WebSocket client disconnected from ${ip}`);
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });
    });

    // Send real-time updates every minute
    setInterval(() => {
      if (this.wss) {
        this.wss.clients.forEach(async (ws) => {
          try {
            if (ws.readyState === ws.OPEN) {
              // TODO: Get tenant-specific real-time metrics
              const metrics = await this.metricsService.getRealTimeMetrics('12345678-1234-5678-9012-123456789012');
              ws.send(JSON.stringify({
                type: 'realtime_update',
                data: metrics,
                timestamp: new Date()
              }));
            }
          } catch (error) {
            console.error('❌ Error sending real-time update:', error);
          }
        });
      }
    }, 60000); // Every minute

    console.log('🔌 WebSocket server initialized on /ws');
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`🛑 Received ${signal}, starting graceful shutdown...`);
      
      try {
        // Close WebSocket server
        if (this.wss) {
          console.log('🔌 Closing WebSocket connections...');
          this.wss.clients.forEach(ws => ws.close());
          this.wss.close();
        }

        // Close HTTP server
        if (this.server) {
          this.server.close();
        }

        // Shutdown services
        await this.eventService.shutdown();
        await this.metricsService.shutdown();

        // Close database connection
        await closeDatabaseConnection();

        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
  }

  async start(): Promise<void> {
    try {
      // Check database connection
      logger.info('Checking database connection...');
      const dbConnected = await checkDatabaseConnection();
      if (!dbConnected) {
        throw new Error('Database connection failed');
      }
      logger.auditSuccess('database_connection', { status: 'connected' });

      // Run migrations
      logger.info('Running database migrations...');
      await runMigrations();
      logger.auditSuccess('database_migrations', { status: 'completed' });

      // Initialize ClickHouse tables
      logger.info('Initializing ClickHouse tables...');
      await this.clickHouseService.initializeTables();
      logger.auditSuccess('clickhouse_initialization', { status: 'completed' });

      // Start server
      const port = config.port;
      
      if (config.analytics.enableRealTime && this.server) {
        this.server.listen(port, () => {
          logger.auditSuccess('server_startup', { 
            port, 
            websocket_enabled: true,
            environment: config.nodeEnv 
          });
          this.logStartupInfo();
        });
      } else {
        this.app.listen(port, () => {
          logger.auditSuccess('server_startup', { 
            port, 
            websocket_enabled: false,
            environment: config.nodeEnv 
          });
          this.logStartupInfo();
        });
      }

      // Setup log rotation (every 24 hours)
      setInterval(() => {
        logger.rotateLogFiles();
      }, 24 * 60 * 60 * 1000);

    } catch (error) {
      logger.auditFailure('server_startup', error);
      process.exit(1);
    }
  }

  private logStartupInfo(): void {
    const startupInfo = {
      service: 'CRM Analytics Service',
      environment: config.nodeEnv,
      database: `${config.database.host}:${config.database.port}/${config.database.database}`,
      redis: config.redis.host ? `${config.redis.host}:${config.redis.port}` : 'Disabled',
      clickhouse: `${config.clickhouse.host}:${config.clickhouse.port}/${config.clickhouse.database}`,
      superset: config.superset.host,
      websocket: config.analytics.enableRealTime,
      batch_size: config.analytics.batchSize,
      flush_interval: config.analytics.flushInterval,
      endpoints: {
        health: `http://localhost:${config.port}/health`,
        docs: `http://localhost:${config.port}/api/docs`,
        events: `http://localhost:${config.port}/api/events/*`,
        dashboard: `http://localhost:${config.port}/api/dashboard/*`,
        crm: `http://localhost:${config.port}/api/crm/*`,
        ...(config.analytics.enableRealTime && { websocket: `ws://localhost:${config.port}/ws` })
      },
      external_services: {
        grafana: 'http://localhost:3001 (admin:admin123)',
        superset: 'http://localhost:8006 (admin:admin123)'
      }
    };

    logger.info('Analytics Service startup completed', startupInfo);
    
    // Also log to console for visibility
    console.log('\n📊 CRM Analytics Service Configuration:');
    console.log(`   Environment: ${config.nodeEnv}`);
    console.log(`   Database: ${config.database.host}:${config.database.port}/${config.database.database}`);
    console.log(`   Redis: ${config.redis.host ? `${config.redis.host}:${config.redis.port}` : 'Disabled'}`);
    console.log(`   ClickHouse: ${config.clickhouse.host}:${config.clickhouse.port}/${config.clickhouse.database}`);
    console.log(`   Superset: ${config.superset.host}`);
    console.log(`   WebSocket: ${config.analytics.enableRealTime ? 'Enabled' : 'Disabled'}`);
    console.log(`   Batch Size: ${config.analytics.batchSize}`);
    console.log(`   Flush Interval: ${config.analytics.flushInterval}ms`);
    console.log('\n✅ Service is ready to accept requests\n');
  }
}

// Start server
const server = new AnalyticsServer();
server.start().catch(error => {
  console.error('❌ Failed to start Analytics Service:', error);
  process.exit(1);
});