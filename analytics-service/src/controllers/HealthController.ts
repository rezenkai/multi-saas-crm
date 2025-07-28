import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { config } from '../config';
import { ClickHouseService } from '../services/ClickHouseService';

export const healthRoutes = Router();

/**
 * GET /health
 * Basic health check endpoint
 */
healthRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Check database connection
    const dbCheck = await checkDatabase();
    
    // Check Redis connection (optional)
    const redisCheck = await checkRedis();
    
    // Check ClickHouse connection
    const clickHouseCheck = await checkClickHouse();

    const responseTime = Date.now() - startTime;
    const status = dbCheck.healthy && redisCheck.healthy && clickHouseCheck.healthy ? 'healthy' : 'unhealthy';

    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      service: 'CRM Analytics Service',
      version: '1.0.0',
      environment: config.nodeEnv,
      uptime: process.uptime(),
      response_time_ms: responseTime,
      checks: {
        database: dbCheck,
        redis: redisCheck,
        clickhouse: clickHouseCheck,
        memory: getMemoryUsage(),
        disk: getDiskUsage()
      }
    });

  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'CRM Analytics Service',
      error: error.message
    });
  }
});

/**
 * GET /health/deep
 * Comprehensive health check with detailed diagnostics
 */
healthRoutes.get('/deep', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Perform comprehensive checks
    const [dbCheck, redisCheck, clickHouseCheck, analyticsCheck] = await Promise.all([
      checkDatabase(true),
      checkRedis(true),
      checkClickHouse(true),
      checkAnalyticsSystem()
    ]);

    const responseTime = Date.now() - startTime;
    const allHealthy = dbCheck.healthy && redisCheck.healthy && clickHouseCheck.healthy && analyticsCheck.healthy;

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'CRM Analytics Service',
      version: '1.0.0',
      environment: config.nodeEnv,
      uptime: process.uptime(),
      response_time_ms: responseTime,
      checks: {
        database: dbCheck,
        redis: redisCheck,
        clickhouse: clickHouseCheck,
        analytics: analyticsCheck,
        system: {
          memory: getMemoryUsage(),
          disk: getDiskUsage(),
          cpu: getCPUUsage()
        },
        configuration: {
          batch_size: config.analytics.batchSize,
          flush_interval: config.analytics.flushInterval,
          realtime_enabled: config.analytics.enableRealTime,
          clickhouse_enabled: true,
          superset_enabled: true
        }
      }
    });

  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'CRM Analytics Service',
      error: error.message,
      stack: config.nodeEnv === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /health/ready
 * Kubernetes readiness probe endpoint
 */
healthRoutes.get('/ready', async (req: Request, res: Response) => {
  try {
    // Quick readiness checks
    const dbHealthy = await checkDatabase();
    
    if (dbHealthy.healthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reason: dbHealthy.error || 'Database not ready'
      });
    }

  } catch (error: any) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      reason: error.message
    });
  }
});

/**
 * GET /health/live
 * Kubernetes liveness probe endpoint
 */
healthRoutes.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * GET /health/metrics
 * Prometheus-style metrics endpoint
 */
healthRoutes.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await getPrometheusMetrics();
    
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);

  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to generate metrics',
      message: error.message
    });
  }
});

// Helper functions
async function checkDatabase(detailed = false): Promise<{healthy: boolean, details?: any, error?: string}> {
  try {
    const client = await db.connect();
    
    const start = Date.now();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    const latency = Date.now() - start;
    
    client.release();

    const details = detailed ? {
      latency_ms: latency,
      current_time: result.rows[0].current_time,
      version: result.rows[0].pg_version,
      pool_size: db.totalCount,
      idle_connections: db.idleCount,
      waiting_connections: db.waitingCount
    } : undefined;

    return {
      healthy: true,
      details
    };

  } catch (error: any) {
    return {
      healthy: false,
      error: error.message
    };
  }
}

async function checkRedis(detailed = false): Promise<{healthy: boolean, details?: any, error?: string}> {
  try {
    if (!config.redis.host) {
      return {
        healthy: true,
        details: detailed ? { status: 'disabled' } : undefined
      };
    }

    // TODO: Implement Redis health check
    return {
      healthy: true,
      details: detailed ? { status: 'not_implemented' } : undefined
    };

  } catch (error: any) {
    return {
      healthy: false,
      error: error.message
    };
  }
}

async function checkAnalyticsSystem(): Promise<{healthy: boolean, details?: any, error?: string}> {
  try {
    // Check if analytics tables exist and have data
    const client = await db.connect();
    
    const tableCheck = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE table_name = 'analytics_events') as events_table,
        COUNT(*) FILTER (WHERE table_name = 'analytics_metrics') as metrics_table,
        COUNT(*) FILTER (WHERE table_name = 'user_sessions') as sessions_table
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('analytics_events', 'analytics_metrics', 'user_sessions')
    `);

    const eventCount = await client.query('SELECT COUNT(*) as count FROM analytics_events LIMIT 1');
    
    client.release();

    const tablesExist = tableCheck.rows[0].events_table === '1' && 
                      tableCheck.rows[0].metrics_table === '1' && 
                      tableCheck.rows[0].sessions_table === '1';

    return {
      healthy: tablesExist,
      details: {
        tables_exist: tablesExist,
        total_events: parseInt(eventCount.rows[0]?.count || '0'),
        last_check: new Date().toISOString()
      }
    };

  } catch (error: any) {
    return {
      healthy: false,
      error: error.message
    };
  }
}

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss_mb: Math.round(usage.rss / 1024 / 1024),
    heap_used_mb: Math.round(usage.heapUsed / 1024 / 1024),
    heap_total_mb: Math.round(usage.heapTotal / 1024 / 1024),
    external_mb: Math.round(usage.external / 1024 / 1024)
  };
}

function getDiskUsage() {
  // TODO: Implement disk usage check
  return {
    status: 'not_implemented'
  };
}

function getCPUUsage() {
  const usage = process.cpuUsage();
  return {
    user_microseconds: usage.user,
    system_microseconds: usage.system
  };
}

async function getPrometheusMetrics(): Promise<string> {
  const metrics: string[] = [];
  
  // System metrics
  const memUsage = getMemoryUsage();
  metrics.push(`# HELP analytics_memory_rss_bytes Resident Set Size memory usage`);
  metrics.push(`# TYPE analytics_memory_rss_bytes gauge`);
  metrics.push(`analytics_memory_rss_bytes ${memUsage.rss_mb * 1024 * 1024}`);
  
  metrics.push(`# HELP analytics_memory_heap_used_bytes Heap memory used`);
  metrics.push(`# TYPE analytics_memory_heap_used_bytes gauge`);
  metrics.push(`analytics_memory_heap_used_bytes ${memUsage.heap_used_mb * 1024 * 1024}`);
  
  metrics.push(`# HELP analytics_uptime_seconds Process uptime in seconds`);
  metrics.push(`# TYPE analytics_uptime_seconds counter`);
  metrics.push(`analytics_uptime_seconds ${Math.floor(process.uptime())}`);

  // Database metrics
  metrics.push(`# HELP analytics_db_connections_total Total database connections`);
  metrics.push(`# TYPE analytics_db_connections_total gauge`);
  metrics.push(`analytics_db_connections_total ${db.totalCount}`);
  
  metrics.push(`# HELP analytics_db_connections_idle Idle database connections`);
  metrics.push(`# TYPE analytics_db_connections_idle gauge`);
  metrics.push(`analytics_db_connections_idle ${db.idleCount}`);

  // TODO: Add business metrics
  try {
    const client = await db.connect();
    const result = await client.query('SELECT COUNT(*) as count FROM analytics_events WHERE timestamp >= CURRENT_DATE');
    client.release();

    metrics.push(`# HELP analytics_events_today_total Events tracked today`);
    metrics.push(`# TYPE analytics_events_today_total counter`);
    metrics.push(`analytics_events_today_total ${result.rows[0]?.count || 0}`);
  } catch (error) {
    console.error('Error getting event metrics for Prometheus:', error);
  }

  return metrics.join('\n') + '\n';
}

async function checkClickHouse(detailed = false): Promise<{healthy: boolean, details?: any, error?: string}> {
  try {
    const clickHouseService = new ClickHouseService();
    const start = Date.now();
    
    const isHealthy = await clickHouseService.healthCheck();
    const latency = Date.now() - start;

    const details = detailed ? {
      latency_ms: latency,
      host: config.clickhouse.host,
      database: config.clickhouse.database,
      last_check: new Date().toISOString()
    } : undefined;

    return {
      healthy: isHealthy,
      details
    };

  } catch (error: any) {
    return {
      healthy: false,
      error: error.message
    };
  }
}