import { Router, Request, Response } from 'express';
import { MetricsService } from '../services/MetricsService';
import axios from 'axios';

interface PostHogConfig {
  host: string;
  projectId: string;
  personalApiKey: string;
}

export function hybridAnalyticsRoutes(metricsService: MetricsService): Router {
  const router = Router();
  
  const postHogConfig: PostHogConfig = {
    host: process.env.POSTHOG_HOST || 'http://localhost:8006',
    projectId: process.env.POSTHOG_PROJECT_ID || '1',
    personalApiKey: process.env.POSTHOG_API_KEY || 'phx-dummy-key'
  };

  /**
   * GET /api/hybrid/dashboard
   * Unified dashboard combining our CRM metrics + PostHog insights
   */
  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      const tenantId = req.get('X-Tenant-ID');
      const period = (req.query.period as string) || '30d';

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      // 1. Get our CRM business metrics
      const [salesMetrics, funnelMetrics, userMetrics] = await Promise.all([
        metricsService.getSalesMetrics(tenantId, period),
        metricsService.getSalesFunnelMetrics(tenantId, period),
        metricsService.getUserActivityMetrics(tenantId, period)
      ]);

      // 2. Get PostHog analytics data
      let postHogData = null;
      try {
        postHogData = await getPostHogInsights(tenantId, period);
      } catch (error) {
        console.warn('⚠️ PostHog data unavailable:', error);
      }

      // 3. Combine both datasets
      const hybridDashboard = {
        crm_metrics: {
          sales: salesMetrics,
          funnel: funnelMetrics,
          users: userMetrics
        },
        posthog_insights: postHogData,
        metadata: {
          tenant_id: tenantId,
          period,
          generated_at: new Date(),
          sources: {
            crm_analytics: true,
            posthog_analytics: postHogData !== null
          }
        }
      };

      res.json({
        success: true,
        data: hybridDashboard
      });

    } catch (error: any) {
      console.error('❌ Error getting hybrid dashboard:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/hybrid/reports/builder
   * Report builder interface using PostHog insights
   */
  router.get('/reports/builder', async (req: Request, res: Response) => {
    try {
      const tenantId = req.get('X-Tenant-ID');

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      // Get available metrics from both sources
      const availableMetrics = {
        crm_metrics: [
          'sales.total_revenue',
          'sales.deals_count', 
          'sales.average_deal_size',
          'funnel.leads_generated',
          'funnel.conversion_rate',
          'users.active_users',
          'users.page_views'
        ],
        posthog_insights: await getPostHogAvailableInsights()
      };

      res.json({
        success: true,
        data: {
          available_metrics: availableMetrics,
          supported_chart_types: [
            'line', 'bar', 'pie', 'funnel', 'table', 'number'
          ],
          supported_time_ranges: [
            '7d', '30d', '90d', '180d', '1y'
          ]
        }
      });

    } catch (error: any) {
      console.error('❌ Error getting report builder config:', error);
      res.status(500).json({
        error: 'Internal Server Error', 
        message: error.message
      });
    }
  });

  /**
   * POST /api/hybrid/reports/create
   * Create custom report using hybrid data
   */
  router.post('/reports/create', async (req: Request, res: Response) => {
    try {
      const tenantId = req.get('X-Tenant-ID');
      const { metrics, chartType, timeRange, filters } = req.body;

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      if (!metrics || !Array.isArray(metrics)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'metrics array is required'
        });
      }

      const reportData = await generateCustomReport(tenantId, {
        metrics,
        chartType: chartType || 'line',
        timeRange: timeRange || '30d',
        filters: filters || {}
      });

      res.json({
        success: true,
        data: reportData
      });

    } catch (error: any) {
      console.error('❌ Error creating custom report:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/hybrid/export/:format
   * Export reports in various formats (leveraging PostHog export capabilities)
   */
  router.get('/export/:format', async (req: Request, res: Response) => {
    try {
      const tenantId = req.get('X-Tenant-ID');
      const { format } = req.params;
      const period = (req.query.period as string) || '30d';

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      if (!['json', 'csv', 'pdf'].includes(format)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Format must be json, csv, or pdf'
        });
      }

      // Get hybrid data
      const hybridData = await getHybridExportData(tenantId, period);

      // Export based on format
      switch (format) {
        case 'csv':
          const csvData = convertToCSV(hybridData);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="crm-report-${tenantId}-${period}.csv"`);
          res.send(csvData);
          break;
          
        case 'pdf':
          // For MVP, return URL to PostHog dashboard
          const postHogDashboardUrl = `${postHogConfig.host}/dashboard/${postHogConfig.projectId}`;
          res.json({
            success: true,
            message: 'PDF export available via PostHog dashboard',
            dashboard_url: postHogDashboardUrl,
            export_instructions: 'Visit the dashboard URL and use PostHog built-in PDF export'
          });
          break;
          
        default:
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="crm-report-${tenantId}-${period}.json"`);
          res.json({
            export_info: {
              tenant_id: tenantId,
              period,
              format,
              exported_at: new Date()
            },
            data: hybridData
          });
      }

    } catch (error: any) {
      console.error('❌ Error exporting report:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  return router;
}

/**
 * Get insights from PostHog API
 */
async function getPostHogInsights(tenantId: string, period: string) {
  const postHogHost = process.env.POSTHOG_HOST || 'http://localhost:8006';
  
  try {
    // Try to get basic insights from PostHog
    const response = await axios.get(`${postHogHost}/api/insight`, {
      params: {
        date_from: `-${period}`,
        properties: JSON.stringify([{
          key: 'tenant_id',
          value: tenantId,
          operator: 'exact'
        }])
      },
      headers: {
        'Authorization': `Bearer ${process.env.POSTHOG_API_KEY || 'phx-dummy-key'}`
      },
      timeout: 5000
    });
    
    return response.data;
  } catch (error) {
    console.warn('PostHog insights unavailable:', error);
    return {
      message: 'PostHog insights unavailable - service may be starting up',
      available_when_ready: true,
      features: [
        'Advanced funnel analysis',
        'User behavior tracking',
        'Custom dashboard builder',
        'Export to CSV/PDF',
        'Cohort analysis'
      ]
    };
  }
}

/**
 * Get available PostHog insights/events
 */
async function getPostHogAvailableInsights(): Promise<string[]> {
  try {
    // Return common PostHog insights
    return [
      'page_views',
      'unique_users',
      'session_duration',
      'bounce_rate',
      'conversion_funnel',
      'retention_cohorts',
      'feature_usage'
    ];
  } catch (error) {
    return [];
  }
}

/**
 * Generate custom report combining CRM + PostHog data
 */
async function generateCustomReport(tenantId: string, config: any) {
  // This would integrate with both our MetricsService and PostHog API
  return {
    report_id: `hybrid_report_${Date.now()}`,
    tenant_id: tenantId,
    config,
    generated_at: new Date(),
    data: {
      message: 'Custom report generation will combine CRM metrics with PostHog insights',
      status: 'mvp_phase'
    }
  };
}

/**
 * Get combined data for export
 */
async function getHybridExportData(tenantId: string, period: string) {
  return {
    tenant_id: tenantId,
    period,
    exported_at: new Date(),
    data: {
      message: 'Hybrid export combining CRM business metrics with PostHog analytics'
    }
  };
}

/**
 * Convert hybrid data to CSV
 */
function convertToCSV(data: any): string {
  const lines = [];
  lines.push('Type,Metric,Value,Date');
  lines.push(`Export,Tenant ID,${data.tenant_id},${data.exported_at}`);
  lines.push(`Export,Period,${data.period},${data.exported_at}`);
  return lines.join('\n');
}