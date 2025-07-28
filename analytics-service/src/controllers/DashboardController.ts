import { Router, Request, Response } from 'express';
import { MetricsService } from '../services/MetricsService';

export function dashboardRoutes(metricsService: MetricsService): Router {
  const router = Router();

  /**
   * GET /api/dashboard/sales
   * Get sales metrics and revenue data
   */
  router.get('/sales', async (req: Request, res: Response) => {
    try {
      const tenantId = req.get('X-Tenant-ID');
      const period = (req.query.period as string) || '30d';

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      // Validate period format
      if (!/^\d+d$/.test(period)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Period must be in format "30d" (number followed by d)'
        });
      }

      const salesMetrics = await metricsService.getSalesMetrics(tenantId, period);

      res.json({
        success: true,
        data: salesMetrics,
        period,
        tenant_id: tenantId,
        generated_at: new Date()
      });

    } catch (error: any) {
      console.error('❌ Error getting sales metrics:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/dashboard/funnel
   * Get sales funnel conversion metrics
   */
  router.get('/funnel', async (req: Request, res: Response) => {
    try {
      const tenantId = req.get('X-Tenant-ID');
      const period = (req.query.period as string) || '30d';

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      if (!/^\d+d$/.test(period)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Period must be in format "30d"'
        });
      }

      const funnelMetrics = await metricsService.getSalesFunnelMetrics(tenantId, period);

      res.json({
        success: true,
        data: funnelMetrics,
        period,
        tenant_id: tenantId,
        generated_at: new Date()
      });

    } catch (error: any) {
      console.error('❌ Error getting funnel metrics:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/dashboard/users
   * Get user activity metrics
   */
  router.get('/users', async (req: Request, res: Response) => {
    try {
      const tenantId = req.get('X-Tenant-ID');
      const period = (req.query.period as string) || '30d';

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      if (!/^\d+d$/.test(period)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Period must be in format "30d"'
        });
      }

      const userMetrics = await metricsService.getUserActivityMetrics(tenantId, period);

      res.json({
        success: true,
        data: userMetrics,
        period,
        tenant_id: tenantId,
        generated_at: new Date()
      });

    } catch (error: any) {
      console.error('❌ Error getting user metrics:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/dashboard/summary
   * Get complete dashboard summary with all metrics
   */
  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const tenantId = req.get('X-Tenant-ID');
      const period = (req.query.period as string) || '30d';

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      if (!/^\d+d$/.test(period)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Period must be in format "30d"'
        });
      }

      const dashboardSummary = await metricsService.getDashboardSummary(tenantId, period);

      res.json({
        success: true,
        data: dashboardSummary,
        period,
        tenant_id: tenantId
      });

    } catch (error: any) {
      console.error('❌ Error getting dashboard summary:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/dashboard/realtime
   * Get real-time metrics for live dashboard
   */
  router.get('/realtime', async (req: Request, res: Response) => {
    try {
      const tenantId = req.get('X-Tenant-ID');

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      const realtimeMetrics = await metricsService.getRealTimeMetrics(tenantId);

      res.json({
        success: true,
        data: realtimeMetrics,
        tenant_id: tenantId,
        is_realtime: true
      });

    } catch (error: any) {
      console.error('❌ Error getting realtime metrics:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/dashboard/metrics/:metricName/history
   * Get historical data for a specific metric
   */
  router.get('/metrics/:metricName/history', async (req: Request, res: Response) => {
    try {
      const tenantId = req.get('X-Tenant-ID');
      const { metricName } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      if (days > 365) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Maximum days is 365'
        });
      }

      const history = await metricsService.getMetricHistory(tenantId, metricName, days);

      res.json({
        success: true,
        data: history,
        metric_name: metricName,
        days,
        tenant_id: tenantId,
        generated_at: new Date()
      });

    } catch (error: any) {
      console.error('❌ Error getting metric history:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/dashboard/export
   * Export dashboard data in various formats
   */
  router.get('/export', async (req: Request, res: Response) => {
    try {
      const tenantId = req.get('X-Tenant-ID');
      const format = (req.query.format as string) || 'json';
      const period = (req.query.period as string) || '30d';

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      if (!['json', 'csv'].includes(format)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Format must be "json" or "csv"'
        });
      }

      const dashboardData = await metricsService.getDashboardSummary(tenantId, period);

      if (format === 'csv') {
        // Convert to CSV format
        const csvData = convertDashboardToCSV(dashboardData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="dashboard-${tenantId}-${period}.csv"`);
        res.send(csvData);
      } else {
        // Return JSON with export metadata
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="dashboard-${tenantId}-${period}.json"`);
        res.json({
          export_info: {
            tenant_id: tenantId,
            period,
            format,
            exported_at: new Date(),
            version: '1.0'
          },
          data: dashboardData
        });
      }

    } catch (error: any) {
      console.error('❌ Error exporting dashboard:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * POST /api/dashboard/refresh
   * Force refresh of dashboard cache
   */
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const tenantId = req.get('X-Tenant-ID');

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      // Clear cache and recalculate metrics
      // TODO: Implement cache clearing in MetricsService
      
      res.json({
        success: true,
        message: 'Dashboard cache refresh initiated',
        tenant_id: tenantId,
        refreshed_at: new Date()
      });

    } catch (error: any) {
      console.error('❌ Error refreshing dashboard:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  return router;
}

/**
 * Helper function to convert dashboard data to CSV format
 */
function convertDashboardToCSV(dashboardData: any): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Category,Metric,Value,Date');
  
  // Sales metrics
  lines.push(`Sales,Total Revenue,${dashboardData.sales.total_revenue},${dashboardData.updated_at}`);
  lines.push(`Sales,Deals Count,${dashboardData.sales.deals_count},${dashboardData.updated_at}`);
  lines.push(`Sales,Average Deal Size,${dashboardData.sales.average_deal_size},${dashboardData.updated_at}`);
  
  // Funnel metrics
  lines.push(`Funnel,Leads Generated,${dashboardData.funnel.leads_generated},${dashboardData.updated_at}`);
  lines.push(`Funnel,Leads Qualified,${dashboardData.funnel.leads_qualified},${dashboardData.updated_at}`);
  lines.push(`Funnel,Meetings Scheduled,${dashboardData.funnel.meetings_scheduled},${dashboardData.updated_at}`);
  lines.push(`Funnel,Proposals Sent,${dashboardData.funnel.proposals_sent},${dashboardData.updated_at}`);
  lines.push(`Funnel,Contracts Signed,${dashboardData.funnel.contracts_signed},${dashboardData.updated_at}`);
  
  // User metrics
  lines.push(`Users,Total Users,${dashboardData.users.total_users},${dashboardData.updated_at}`);
  lines.push(`Users,Active Users Today,${dashboardData.users.active_users_today},${dashboardData.updated_at}`);
  lines.push(`Users,Page Views,${dashboardData.users.page_views},${dashboardData.updated_at}`);
  
  return lines.join('\n');
}