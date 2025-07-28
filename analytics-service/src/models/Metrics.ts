// Модель для предрассчитанных метрик
export interface AnalyticsMetric {
  id?: string;
  tenant_id: string;
  metric_name: string;
  metric_value: number;
  dimensions?: Record<string, any>;
  period_start: Date;
  period_end: Date;
  created_at?: Date;
}

// Типы метрик
export enum MetricType {
  // Sales Metrics
  TOTAL_REVENUE = 'total_revenue',
  DEALS_COUNT = 'deals_count',
  AVERAGE_DEAL_SIZE = 'average_deal_size',
  CONVERSION_RATE = 'conversion_rate',
  SALES_VELOCITY = 'sales_velocity',
  WIN_RATE = 'win_rate',
  
  // User Activity Metrics
  ACTIVE_USERS = 'active_users',
  PAGE_VIEWS = 'page_views',
  SESSION_DURATION = 'session_duration',
  FEATURE_USAGE = 'feature_usage',
  
  // Lead Metrics  
  LEADS_GENERATED = 'leads_generated',
  LEADS_QUALIFIED = 'leads_qualified',
  LEAD_CONVERSION_RATE = 'lead_conversion_rate',
  
  // Company Metrics
  COMPANIES_CREATED = 'companies_created',
  COMPANIES_UPDATED = 'companies_updated',
  
  // Contact Metrics
  CONTACTS_CREATED = 'contacts_created',
  CONTACTS_UPDATED = 'contacts_updated',
  
  // Performance Metrics
  API_RESPONSE_TIME = 'api_response_time',
  ERROR_RATE = 'error_rate',
  SYSTEM_UPTIME = 'system_uptime',
}

// Временные периоды для метрик
export enum MetricPeriod {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

// Интерфейс для запроса метрик
export interface MetricQuery {
  tenantId: string;
  metricType: MetricType;
  period: MetricPeriod;
  startDate: Date;
  endDate: Date;
  dimensions?: string[];
  filters?: Record<string, any>;
}

// Результат расчета метрики
export interface MetricResult {
  metric_name: string;
  value: number;
  period_start: Date;
  period_end: Date;
  dimensions?: Record<string, any>;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    previous_value: number;
  };
}

// Sales Funnel метрики
export interface SalesFunnelMetrics {
  leads_generated: number;
  leads_qualified: number;
  meetings_scheduled: number;
  proposals_sent: number;
  contracts_signed: number;
  conversion_rates: {
    lead_to_qualified: number;
    qualified_to_meeting: number;
    meeting_to_proposal: number;
    proposal_to_contract: number;
    overall_conversion: number;
  };
}

// Revenue метрики
export interface RevenueMetrics {
  total_revenue: number;
  monthly_recurring_revenue: number;
  average_deal_size: number;
  deals_count: number;
  revenue_by_stage: Record<string, number>;
  revenue_by_source: Record<string, number>;
  revenue_trend: Array<{
    date: string;
    value: number;
  }>;
}

// User Activity метрики
export interface UserActivityMetrics {
  total_users: number;
  active_users_today: number;
  active_users_week: number;
  active_users_month: number;
  average_session_duration: number;
  page_views: number;
  most_used_features: Array<{
    feature: string;
    usage_count: number;
    unique_users: number;
  }>;
  user_retention: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

// Performance метрики
export interface PerformanceMetrics {
  average_response_time: number;
  error_rate: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  slow_queries: number;
  database_connections: number;
  memory_usage: number;
  cpu_usage: number;
}

// Dashboard Summary
export interface DashboardSummary {
  tenant_id: string;
  period: {
    start: Date;
    end: Date;
  };
  sales: RevenueMetrics;
  funnel: SalesFunnelMetrics;
  users: UserActivityMetrics;
  performance: PerformanceMetrics;
  updated_at: Date;
}

// Утилита для создания метрик
export class MetricBuilder {
  private metric: Partial<AnalyticsMetric> = {};

  static create(): MetricBuilder {
    return new MetricBuilder();
  }

  tenantId(tenantId: string): MetricBuilder {
    this.metric.tenant_id = tenantId;
    return this;
  }

  name(metricName: MetricType | string): MetricBuilder {
    this.metric.metric_name = metricName;
    return this;
  }

  value(value: number): MetricBuilder {
    this.metric.metric_value = value;
    return this;
  }

  dimensions(dimensions: Record<string, any>): MetricBuilder {
    this.metric.dimensions = { ...this.metric.dimensions, ...dimensions };
    return this;
  }

  period(start: Date, end: Date): MetricBuilder {
    this.metric.period_start = start;
    this.metric.period_end = end;
    return this;
  }

  build(): AnalyticsMetric {
    if (!this.metric.tenant_id || !this.metric.metric_name || this.metric.metric_value === undefined) {
      throw new Error('tenant_id, metric_name, and metric_value are required');
    }

    if (!this.metric.period_start || !this.metric.period_end) {
      throw new Error('period_start and period_end are required');
    }

    return {
      ...this.metric,
      created_at: new Date(),
    } as AnalyticsMetric;
  }
}