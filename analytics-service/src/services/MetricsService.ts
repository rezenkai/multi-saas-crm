import { Pool, PoolClient } from 'pg';
import { Redis } from 'ioredis';
import { db } from '../config/database';
import { 
  AnalyticsMetric, 
  MetricType, 
  MetricPeriod, 
  MetricQuery, 
  MetricResult,
  SalesFunnelMetrics,
  RevenueMetrics,
  UserActivityMetrics,
  PerformanceMetrics,
  DashboardSummary,
  MetricBuilder
} from '../models/Metrics';
import { config } from '../config';

export class MetricsService {
  private redis?: Redis;
  private metricsCache = new Map<string, {data: any, expiry: number}>();

  constructor() {
    // Инициализируем Redis для кэширования метрик
    if (config.redis.host) {
      this.redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.database + 1, // Используем отдельную БД для метрик
        enableOfflineQueue: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redis.on('error', (err: any) => {
        console.error('❌ Redis connection error in MetricsService:', err);
      });

      this.redis.on('connect', () => {
        console.log('✅ MetricsService connected to Redis');
      });
    }

    // Запускаем периодический пересчет метрик
    this.startMetricsCalculation();
  }

  /**
   * Получение sales метрик
   */
  async getSalesMetrics(tenantId: string, period: string = '30d'): Promise<RevenueMetrics> {
    const cacheKey = `sales_metrics:${tenantId}:${period}`;
    
    // Проверяем кэш
    const cachedResult = await this.getFromCache<RevenueMetrics>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const periodDays = parseInt(period.replace('d', ''));
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const client = await db.connect();
    
    try {
      // Общая выручка и количество сделок
      const revenueQuery = `
        SELECT 
          SUM((properties->>'amount')::numeric) as total_revenue,
          COUNT(*) as deals_count,
          AVG((properties->>'amount')::numeric) as avg_deal_size
        FROM analytics_events 
        WHERE tenant_id = $1 
          AND event_name = 'Opportunity Won'
          AND timestamp >= $2
          AND (properties->>'amount') IS NOT NULL
      `;

      // Выручка по стадиям
      const stageRevenueQuery = `
        SELECT 
          properties->>'stage' as stage,
          SUM((properties->>'amount')::numeric) as revenue
        FROM analytics_events 
        WHERE tenant_id = $1 
          AND event_name = 'Opportunity Won'
          AND timestamp >= $2
          AND (properties->>'amount') IS NOT NULL
        GROUP BY properties->>'stage'
      `;

      // Выручка по источникам
      const sourceRevenueQuery = `
        SELECT 
          COALESCE(properties->>'source', 'Unknown') as source,
          SUM((properties->>'amount')::numeric) as revenue
        FROM analytics_events 
        WHERE tenant_id = $1 
          AND event_name = 'Opportunity Won'
          AND timestamp >= $2
          AND (properties->>'amount') IS NOT NULL
        GROUP BY properties->>'source'
      `;

      // Тренд по дням
      const trendQuery = `
        SELECT 
          DATE(timestamp) as date,
          SUM((properties->>'amount')::numeric) as daily_revenue,
          COUNT(*) as daily_deals
        FROM analytics_events 
        WHERE tenant_id = $1 
          AND event_name = 'Opportunity Won'
          AND timestamp >= $2
          AND (properties->>'amount') IS NOT NULL
        GROUP BY DATE(timestamp)
        ORDER BY date
      `;

      const [revenueResult, stageResult, sourceResult, trendResult] = await Promise.all([
        client.query(revenueQuery, [tenantId, startDate]),
        client.query(stageRevenueQuery, [tenantId, startDate]),
        client.query(sourceRevenueQuery, [tenantId, startDate]),
        client.query(trendQuery, [tenantId, startDate])
      ]);

      const metrics: RevenueMetrics = {
        total_revenue: parseFloat(revenueResult.rows[0]?.total_revenue || '0'),
        monthly_recurring_revenue: 0, // TODO: Implement MRR calculation
        average_deal_size: parseFloat(revenueResult.rows[0]?.avg_deal_size || '0'),
        deals_count: parseInt(revenueResult.rows[0]?.deals_count || '0'),
        revenue_by_stage: stageResult.rows.reduce((acc, row) => {
          acc[row.stage] = parseFloat(row.revenue);
          return acc;
        }, {} as Record<string, number>),
        revenue_by_source: sourceResult.rows.reduce((acc, row) => {
          acc[row.source] = parseFloat(row.revenue);
          return acc;
        }, {} as Record<string, number>),
        revenue_trend: trendResult.rows.map(row => ({
          date: row.date.toISOString().split('T')[0],
          value: parseFloat(row.daily_revenue)
        }))
      };

      // Кэшируем результат на 10 минут
      await this.setCache(cacheKey, metrics, 600);

      return metrics;

    } finally {
      client.release();
    }
  }

  /**
   * Получение sales funnel метрик
   */
  async getSalesFunnelMetrics(tenantId: string, period: string = '30d'): Promise<SalesFunnelMetrics> {
    const cacheKey = `funnel_metrics:${tenantId}:${period}`;
    
    const cachedResult = await this.getFromCache<SalesFunnelMetrics>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const periodDays = parseInt(period.replace('d', ''));
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const client = await db.connect();
    
    try {
      const funnelQuery = `
        SELECT 
          event_name,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users
        FROM analytics_events 
        WHERE tenant_id = $1 
          AND event_name IN ('Lead Generated', 'Lead Qualified', 'Meeting Scheduled', 'Proposal Sent', 'Contract Signed')
          AND timestamp >= $2
        GROUP BY event_name
        ORDER BY 
          CASE event_name
            WHEN 'Lead Generated' THEN 1
            WHEN 'Lead Qualified' THEN 2
            WHEN 'Meeting Scheduled' THEN 3
            WHEN 'Proposal Sent' THEN 4
            WHEN 'Contract Signed' THEN 5
          END
      `;

      const result = await client.query(funnelQuery, [tenantId, startDate]);
      const funnelData = result.rows.reduce((acc, row) => {
        acc[row.event_name.toLowerCase().replace(/\s+/g, '_')] = parseInt(row.count);
        return acc;
      }, {} as any);

      const metrics: SalesFunnelMetrics = {
        leads_generated: funnelData.lead_generated || 0,
        leads_qualified: funnelData.lead_qualified || 0,
        meetings_scheduled: funnelData.meeting_scheduled || 0,
        proposals_sent: funnelData.proposal_sent || 0,
        contracts_signed: funnelData.contract_signed || 0,
        conversion_rates: {
          lead_to_qualified: this.calculateConversionRate(funnelData.leads_qualified, funnelData.leads_generated),
          qualified_to_meeting: this.calculateConversionRate(funnelData.meeting_scheduled, funnelData.leads_qualified),
          meeting_to_proposal: this.calculateConversionRate(funnelData.proposal_sent, funnelData.meeting_scheduled),
          proposal_to_contract: this.calculateConversionRate(funnelData.contract_signed, funnelData.proposal_sent),
          overall_conversion: this.calculateConversionRate(funnelData.contract_signed, funnelData.leads_generated)
        }
      };

      await this.setCache(cacheKey, metrics, 300); // 5 минут кэш

      return metrics;

    } finally {
      client.release();
    }
  }

  /**
   * Получение user activity метрик
   */
  async getUserActivityMetrics(tenantId: string, period: string = '30d'): Promise<UserActivityMetrics> {
    const cacheKey = `user_activity:${tenantId}:${period}`;
    
    const cachedResult = await this.getFromCache<UserActivityMetrics>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const periodDays = parseInt(period.replace('d', ''));
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const client = await db.connect();
    
    try {
      // Общие пользовательские метрики
      const userStatsQuery = `
        SELECT 
          COUNT(DISTINCT user_id) FILTER (WHERE timestamp >= $2) as active_users_period,
          COUNT(DISTINCT user_id) FILTER (WHERE timestamp >= CURRENT_DATE) as active_users_today,
          COUNT(DISTINCT user_id) FILTER (WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days') as active_users_week,
          COUNT(DISTINCT user_id) FILTER (WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days') as active_users_month,
          COUNT(*) FILTER (WHERE event_name = 'Page Viewed' AND timestamp >= $2) as page_views
        FROM analytics_events
        WHERE tenant_id = $1 AND user_id IS NOT NULL
      `;

      // Средняя длительность сессии
      const sessionDurationQuery = `
        SELECT AVG(duration_seconds) as avg_duration
        FROM user_sessions
        WHERE tenant_id = $1 
          AND started_at >= $2
          AND duration_seconds > 0
      `;

      // Самые используемые функции
      const topFeaturesQuery = `
        SELECT 
          properties->>'feature' as feature,
          COUNT(*) as usage_count,
          COUNT(DISTINCT user_id) as unique_users,
          AVG((properties->>'time_spent')::numeric) as avg_time_spent
        FROM analytics_events 
        WHERE tenant_id = $1 
          AND event_name = 'Feature Used'
          AND timestamp >= $2
          AND properties->>'feature' IS NOT NULL
        GROUP BY properties->>'feature'
        ORDER BY usage_count DESC
        LIMIT 15
      `;

      const [statsResult, durationResult, featuresResult] = await Promise.all([
        client.query(userStatsQuery, [tenantId, startDate]),
        client.query(sessionDurationQuery, [tenantId, startDate]),
        client.query(topFeaturesQuery, [tenantId, startDate])
      ]);

      const stats = statsResult.rows[0];
      
      const metrics: UserActivityMetrics = {
        total_users: parseInt(stats.active_users_period || '0'),
        active_users_today: parseInt(stats.active_users_today || '0'),
        active_users_week: parseInt(stats.active_users_week || '0'),
        active_users_month: parseInt(stats.active_users_month || '0'),
        average_session_duration: parseFloat(durationResult.rows[0]?.avg_duration || '0'),
        page_views: parseInt(stats.page_views || '0'),
        most_used_features: featuresResult.rows.map(row => ({
          feature: row.feature,
          usage_count: parseInt(row.usage_count),
          unique_users: parseInt(row.unique_users)
        })),
        user_retention: {
          daily: 0, // TODO: Calculate retention
          weekly: 0,
          monthly: 0
        }
      };

      await this.setCache(cacheKey, metrics, 300);

      return metrics;

    } finally {
      client.release();
    }
  }

  /**
   * Получение dashboard summary
   */
  async getDashboardSummary(tenantId: string, period: string = '30d'): Promise<DashboardSummary> {
    const [sales, funnel, users] = await Promise.all([
      this.getSalesMetrics(tenantId, period),
      this.getSalesFunnelMetrics(tenantId, period),
      this.getUserActivityMetrics(tenantId, period)
    ]);

    const performance: PerformanceMetrics = {
      average_response_time: 0, // TODO: Implement
      error_rate: 0,
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      slow_queries: 0,
      database_connections: 0,
      memory_usage: 0,
      cpu_usage: 0
    };

    const periodDays = parseInt(period.replace('d', ''));
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    return {
      tenant_id: tenantId,
      period: {
        start: startDate,
        end: endDate
      },
      sales,
      funnel,
      users,
      performance,
      updated_at: new Date()
    };
  }

  /**
   * Сохранение предрассчитанной метрики
   */
  async saveMetric(metric: AnalyticsMetric): Promise<void> {
    const client = await db.connect();
    
    try {
      const query = `
        INSERT INTO analytics_metrics 
        (tenant_id, metric_name, metric_value, dimensions, period_start, period_end)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (tenant_id, metric_name, period_start, period_end) 
        DO UPDATE SET 
          metric_value = EXCLUDED.metric_value,
          dimensions = EXCLUDED.dimensions,
          created_at = CURRENT_TIMESTAMP
      `;
      
      await client.query(query, [
        metric.tenant_id,
        metric.metric_name,
        metric.metric_value,
        JSON.stringify(metric.dimensions || {}),
        metric.period_start,
        metric.period_end
      ]);

    } finally {
      client.release();
    }
  }

  /**
   * Получение исторических данных метрики
   */
  async getMetricHistory(tenantId: string, metricName: string, days: number = 30): Promise<Array<{date: string, value: number}>> {
    const client = await db.connect();
    
    try {
      const query = `
        SELECT 
          DATE(period_start) as date,
          metric_value as value
        FROM analytics_metrics
        WHERE tenant_id = $1 
          AND metric_name = $2
          AND period_start >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY date ASC
      `;
      
      const result = await client.query(query, [tenantId, metricName]);
      return result.rows.map(row => ({
        date: row.date.toISOString().split('T')[0],
        value: parseFloat(row.value)
      }));

    } finally {
      client.release();
    }
  }

  /**
   * Real-time метрики для dashboard
   */
  async getRealTimeMetrics(tenantId: string): Promise<any> {
    const client = await db.connect();
    
    try {
      const todayQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE event_name = 'Lead Generated') as leads_today,
          COUNT(*) FILTER (WHERE event_name = 'Opportunity Created') as opps_today,
          COUNT(*) FILTER (WHERE event_name = 'Opportunity Won') as wins_today,
          SUM((properties->>'amount')::numeric) FILTER (WHERE event_name = 'Opportunity Won') as revenue_today,
          COUNT(DISTINCT user_id) as active_users_today,
          COUNT(*) FILTER (WHERE event_name = 'Page Viewed') as page_views_today
        FROM analytics_events 
        WHERE tenant_id = $1 
          AND DATE(timestamp) = CURRENT_DATE
      `;

      const result = await client.query(todayQuery, [tenantId]);
      const row = result.rows[0];

      return {
        leads_today: parseInt(row.leads_today || '0'),
        opps_today: parseInt(row.opps_today || '0'),
        wins_today: parseInt(row.wins_today || '0'),
        revenue_today: parseFloat(row.revenue_today || '0'),
        active_users_today: parseInt(row.active_users_today || '0'),
        page_views_today: parseInt(row.page_views_today || '0'),
        timestamp: new Date()
      };

    } finally {
      client.release();
    }
  }

  /**
   * Приватные методы
   */
  private calculateConversionRate(numerator: number, denominator: number): number {
    if (!denominator || denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100 * 100) / 100; // Round to 2 decimal places
  }

  private async getFromCache<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        console.warn('⚠️  Cache get error:', error);
      }
    }

    // Fallback to in-memory cache
    const cached = this.metricsCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    return null;
  }

  private async setCache<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
      } catch (error) {
        console.warn('⚠️  Cache set error:', error);
      }
    }

    // Fallback to in-memory cache
    this.metricsCache.set(key, {
      data,
      expiry: Date.now() + (ttlSeconds * 1000)
    });

    // Cleanup old in-memory cache entries
    if (this.metricsCache.size > 1000) {
      const now = Date.now();
      for (const [k, v] of this.metricsCache.entries()) {
        if (v.expiry < now) {
          this.metricsCache.delete(k);
        }
      }
    }
  }

  private startMetricsCalculation(): void {
    // Пересчитываем метрики каждую минуту
    setInterval(async () => {
      try {
        await this.calculateDailyMetrics();
      } catch (error) {
        console.error('❌ Error calculating metrics:', error);
      }
    }, config.analytics.metricsRefreshInterval);

    console.log('🔄 Metrics calculation scheduler started');
  }

  private async calculateDailyMetrics(): Promise<void> {
    // TODO: Implement automatic daily metrics calculation
    // This would run queries to pre-calculate common metrics
    // and store them in the analytics_metrics table
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🔄 MetricsService shutting down...');
    
    if (this.redis) {
      await this.redis.quit();
    }

    this.metricsCache.clear();

    console.log('✅ MetricsService shutdown complete');
  }
}