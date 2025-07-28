import { Request, Response } from 'express';
import { CrmAnalyticsService } from '../services/CrmAnalyticsService';

/**
 * Контроллер для CRM-специфичной аналитики
 * Реализует все отчеты из ТЗ
 */
export class CrmAnalyticsController {
    private crmAnalyticsService: CrmAnalyticsService;

    constructor() {
        this.crmAnalyticsService = new CrmAnalyticsService();
    }

    /**
     * Отчет "Объем продаж по месяцам"
     * GET /api/crm/sales-by-month
     */
    public async getSalesByMonth(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate, managerId } = req.query;
            
            const report = await this.crmAnalyticsService.getSalesByMonth({
                startDate: startDate as string,
                endDate: endDate as string,
                managerId: managerId as string
            });

            res.json({
                success: true,
                data: report,
                meta: {
                    reportType: 'sales_by_month',
                    generatedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error in getSalesByMonth:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate sales by month report'
            });
        }
    }

    /**
     * Отчет "Активность менеджеров"
     * GET /api/crm/manager-activity
     */
    public async getManagerActivity(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate, departmentId } = req.query;
            
            const report = await this.crmAnalyticsService.getManagerActivity({
                startDate: startDate as string,
                endDate: endDate as string,
                departmentId: departmentId as string
            });

            res.json({
                success: true,
                data: report,
                meta: {
                    reportType: 'manager_activity',
                    generatedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error in getManagerActivity:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate manager activity report'
            });
        }
    }

    /**
     * Отчет "Лиды по источникам" 
     * GET /api/crm/leads-by-source
     */
    public async getLeadsBySource(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate, sourceType } = req.query;
            
            const report = await this.crmAnalyticsService.getLeadsBySource({
                startDate: startDate as string,
                endDate: endDate as string,
                sourceType: sourceType as string
            });

            res.json({
                success: true,
                data: report,
                meta: {
                    reportType: 'leads_by_source',
                    generatedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error in getLeadsBySource:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate leads by source report'
            });
        }
    }

    /**
     * Отчет "Конверсия лидов в сделки"
     * GET /api/crm/lead-conversion
     */
    public async getLeadConversion(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate, managerId, sourceType } = req.query;
            
            const report = await this.crmAnalyticsService.getLeadConversion({
                startDate: startDate as string,
                endDate: endDate as string,
                managerId: managerId as string,
                sourceType: sourceType as string
            });

            res.json({
                success: true,
                data: report,
                meta: {
                    reportType: 'lead_conversion',
                    generatedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error in getLeadConversion:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate lead conversion report'
            });
        }
    }

    /**
     * Воронка продаж (Sales Pipeline)
     * GET /api/crm/sales-funnel
     */
    public async getSalesFunnel(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate, managerId } = req.query;
            
            const report = await this.crmAnalyticsService.getSalesFunnel({
                startDate: startDate as string,
                endDate: endDate as string,
                managerId: managerId as string
            });

            res.json({
                success: true,
                data: report,
                meta: {
                    reportType: 'sales_funnel',
                    generatedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error in getSalesFunnel:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate sales funnel report'
            });
        }
    }

    /**
     * Список всех доступных отчетов
     * GET /api/crm/reports
     */
    public async getAvailableReports(req: Request, res: Response): Promise<void> {
        try {
            const reports = [
                {
                    id: 'sales_by_month',
                    name: 'Объем продаж по месяцам',
                    description: 'График суммы закрытых сделок помесячно',
                    endpoint: '/api/crm/sales-by-month',
                    parameters: ['startDate', 'endDate', 'managerId?']
                },
                {
                    id: 'manager_activity',
                    name: 'Активность менеджеров',
                    description: 'Количество задач выполненных каждым менеджером за период',
                    endpoint: '/api/crm/manager-activity',
                    parameters: ['startDate', 'endDate', 'departmentId?']
                },
                {
                    id: 'leads_by_source',
                    name: 'Лиды по источникам',
                    description: 'Количество лидов пришедших с каждого канала',
                    endpoint: '/api/crm/leads-by-source',
                    parameters: ['startDate', 'endDate', 'sourceType?']
                },
                {
                    id: 'lead_conversion',
                    name: 'Конверсия лидов в сделки',
                    description: 'Процент лидов, ставших сделками',
                    endpoint: '/api/crm/lead-conversion',
                    parameters: ['startDate', 'endDate', 'managerId?', 'sourceType?']
                },
                {
                    id: 'sales_funnel',
                    name: 'Воронка продаж',
                    description: 'Количество/сумма сделок на каждом этапе воронки',
                    endpoint: '/api/crm/sales-funnel',
                    parameters: ['startDate', 'endDate', 'managerId?']
                }
            ];

            res.json({
                success: true,
                data: reports,
                meta: {
                    totalReports: reports.length,
                    generatedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error in getAvailableReports:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get available reports'
            });
        }
    }

    /**
     * Экспорт отчета в различных форматах
     * POST /api/crm/export
     */
    public async exportReport(req: Request, res: Response): Promise<void> {
        try {
            const { reportType, format, parameters } = req.body;
            
            const exportResult = await this.crmAnalyticsService.exportReport({
                reportType,
                format, // 'csv', 'excel', 'pdf'
                parameters
            });

            if (format === 'csv' || format === 'excel') {
                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Content-Disposition', `attachment; filename="${reportType}_${Date.now()}.${format}"`);
                res.send(exportResult.data);
            } else {
                res.json({
                    success: true,
                    data: exportResult,
                    meta: {
                        exportFormat: format,
                        generatedAt: new Date().toISOString()
                    }
                });
            }
        } catch (error) {
            console.error('Error in exportReport:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to export report'
            });
        }
    }
}