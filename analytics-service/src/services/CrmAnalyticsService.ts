import { ClickHouseService } from './ClickHouseService';
import { PostgresService } from './PostgresService';

export interface SalesByMonthParams {
    startDate?: string;
    endDate?: string;
    managerId?: string;
}

export interface ManagerActivityParams {
    startDate?: string;
    endDate?: string;
    departmentId?: string;
}

export interface LeadsBySourceParams {
    startDate?: string;
    endDate?: string;
    sourceType?: string;
}

export interface LeadConversionParams {
    startDate?: string;
    endDate?: string;
    managerId?: string;
    sourceType?: string;
}

export interface SalesFunnelParams {
    startDate?: string;
    endDate?: string;
    managerId?: string;
}

export interface ExportParams {
    reportType: string;
    format: 'csv' | 'excel' | 'pdf';
    parameters: any;
}

/**
 * Сервис для CRM аналитики
 * Реализует бизнес-логику всех отчетов из ТЗ
 */
export class CrmAnalyticsService {
    private clickHouseService: ClickHouseService;
    private postgresService: PostgresService;

    constructor() {
        this.clickHouseService = new ClickHouseService();
        this.postgresService = new PostgresService();
    }

    /**
     * Объем продаж по месяцам
     */
    async getSalesByMonth(params: SalesByMonthParams) {
        const { startDate, endDate, managerId } = params;
        
        let query = `
            SELECT 
                toYYYYMM(closed_date) as month,
                count(*) as deals_count,
                sum(amount) as total_amount,
                avg(amount) as avg_amount,
                manager_id,
                manager_name
            FROM crm_analytics.deals 
            WHERE status = 'closed_won'
        `;

        const conditions = [];
        if (startDate) conditions.push(`closed_date >= '${startDate}'`);
        if (endDate) conditions.push(`closed_date <= '${endDate}'`);
        if (managerId) conditions.push(`manager_id = '${managerId}'`);

        if (conditions.length > 0) {
            query += ` AND ${conditions.join(' AND ')}`;
        }

        query += `
            GROUP BY month, manager_id, manager_name
            ORDER BY month DESC
        `;

        const result = await this.clickHouseService.query(query);
        
        return {
            reportName: 'Объем продаж по месяцам',
            data: result.data,
            summary: {
                totalDeals: result.data.reduce((sum: number, row: any) => sum + row.deals_count, 0),
                totalAmount: result.data.reduce((sum: number, row: any) => sum + row.total_amount, 0),
                averageAmount: result.data.reduce((sum: number, row: any) => sum + row.avg_amount, 0) / result.data.length
            }
        };
    }

    /**
     * Активность менеджеров
     */
    async getManagerActivity(params: ManagerActivityParams) {
        const { startDate, endDate, departmentId } = params;
        
        let query = `
            SELECT 
                manager_id,
                manager_name,
                department_id,
                department_name,
                count(*) as tasks_completed,
                countIf(task_type = 'call') as calls_made,
                countIf(task_type = 'meeting') as meetings_held,
                countIf(task_type = 'email') as emails_sent,
                avg(task_duration_minutes) as avg_task_duration
            FROM crm_analytics.activities 
            WHERE status = 'completed'
        `;

        const conditions = [];
        if (startDate) conditions.push(`completed_date >= '${startDate}'`);
        if (endDate) conditions.push(`completed_date <= '${endDate}'`);
        if (departmentId) conditions.push(`department_id = '${departmentId}'`);

        if (conditions.length > 0) {
            query += ` AND ${conditions.join(' AND ')}`;
        }

        query += `
            GROUP BY manager_id, manager_name, department_id, department_name
            ORDER BY tasks_completed DESC
        `;

        const result = await this.clickHouseService.query(query);
        
        return {
            reportName: 'Активность менеджеров',
            data: result.data,
            summary: {
                totalManagers: result.data.length,
                totalTasks: result.data.reduce((sum: number, row: any) => sum + row.tasks_completed, 0),
                avgTasksPerManager: result.data.reduce((sum: number, row: any) => sum + row.tasks_completed, 0) / result.data.length
            }
        };
    }

    /**
     * Лиды по источникам
     */
    async getLeadsBySource(params: LeadsBySourceParams) {
        const { startDate, endDate, sourceType } = params;
        
        let query = `
            SELECT 
                source_type,
                source_name,
                count(*) as leads_count,
                countIf(status = 'qualified') as qualified_leads,
                countIf(status = 'converted') as converted_leads,
                sum(estimated_value) as total_estimated_value,
                (countIf(status = 'qualified') * 100.0 / count(*)) as qualification_rate,
                (countIf(status = 'converted') * 100.0 / count(*)) as conversion_rate
            FROM crm_analytics.leads 
            WHERE 1=1
        `;

        const conditions = [];
        if (startDate) conditions.push(`created_date >= '${startDate}'`);
        if (endDate) conditions.push(`created_date <= '${endDate}'`);
        if (sourceType) conditions.push(`source_type = '${sourceType}'`);

        if (conditions.length > 0) {
            query += ` AND ${conditions.join(' AND ')}`;
        }

        query += `
            GROUP BY source_type, source_name
            ORDER BY leads_count DESC
        `;

        const result = await this.clickHouseService.query(query);
        
        return {
            reportName: 'Лиды по источникам',
            data: result.data,
            summary: {
                totalLeads: result.data.reduce((sum: number, row: any) => sum + row.leads_count, 0),
                totalSources: result.data.length,
                avgConversionRate: result.data.reduce((sum: number, row: any) => sum + row.conversion_rate, 0) / result.data.length
            }
        };
    }

    /**
     * Конверсия лидов в сделки
     */
    async getLeadConversion(params: LeadConversionParams) {
        const { startDate, endDate, managerId, sourceType } = params;
        
        let query = `
            SELECT 
                l.source_type,
                l.source_name,
                l.manager_id,
                l.manager_name,
                count(l.id) as total_leads,
                count(d.id) as converted_deals,
                (count(d.id) * 100.0 / count(l.id)) as conversion_rate,
                sum(d.amount) as total_deal_amount,
                avg(d.amount) as avg_deal_amount,
                avg(dateDiff('day', l.created_date, d.created_date)) as avg_conversion_days
            FROM crm_analytics.leads l
            LEFT JOIN crm_analytics.deals d ON l.id = d.lead_id AND d.status != 'lost'
            WHERE 1=1
        `;

        const conditions = [];
        if (startDate) conditions.push(`l.created_date >= '${startDate}'`);
        if (endDate) conditions.push(`l.created_date <= '${endDate}'`);
        if (managerId) conditions.push(`l.manager_id = '${managerId}'`);
        if (sourceType) conditions.push(`l.source_type = '${sourceType}'`);

        if (conditions.length > 0) {
            query += ` AND ${conditions.join(' AND ')}`;
        }

        query += `
            GROUP BY l.source_type, l.source_name, l.manager_id, l.manager_name
            ORDER BY conversion_rate DESC
        `;

        const result = await this.clickHouseService.query(query);
        
        return {
            reportName: 'Конверсия лидов в сделки',
            data: result.data,
            summary: {
                totalLeads: result.data.reduce((sum: number, row: any) => sum + row.total_leads, 0),
                totalDeals: result.data.reduce((sum: number, row: any) => sum + row.converted_deals, 0),
                overallConversionRate: (result.data.reduce((sum: number, row: any) => sum + row.converted_deals, 0) * 100.0) / result.data.reduce((sum: number, row: any) => sum + row.total_leads, 0)
            }
        };
    }

    /**
     * Воронка продаж
     */
    async getSalesFunnel(params: SalesFunnelParams) {
        const { startDate, endDate, managerId } = params;
        
        let query = `
            SELECT 
                stage,
                stage_order,
                count(*) as deals_count,
                sum(amount) as total_amount,
                avg(amount) as avg_amount,
                min(amount) as min_amount,
                max(amount) as max_amount,
                avg(days_in_stage) as avg_days_in_stage
            FROM crm_analytics.deals 
            WHERE status NOT IN ('lost', 'cancelled')
        `;

        const conditions = [];
        if (startDate) conditions.push(`created_date >= '${startDate}'`);
        if (endDate) conditions.push(`created_date <= '${endDate}'`);
        if (managerId) conditions.push(`manager_id = '${managerId}'`);

        if (conditions.length > 0) {
            query += ` AND ${conditions.join(' AND ')}`;
        }

        query += `
            GROUP BY stage, stage_order
            ORDER BY stage_order ASC
        `;

        const result = await this.clickHouseService.query(query);
        
        // Рассчитываем конверсию между этапами
        const data = result.data.map((row: any, index: number) => {
            const conversionRate = index > 0 ? 
                (row.deals_count * 100.0) / result.data[index - 1].deals_count : 
                100.0;
            
            return {
                ...row,
                conversion_rate: conversionRate
            };
        });
        
        return {
            reportName: 'Воронка продаж',
            data: data,
            summary: {
                totalStages: data.length,
                totalDeals: data.reduce((sum: number, row: any) => sum + row.deals_count, 0),
                totalAmount: data.reduce((sum: number, row: any) => sum + row.total_amount, 0),
                overallConversionRate: data.length > 0 ? (data[data.length - 1].deals_count * 100.0) / data[0].deals_count : 0
            }
        };
    }

    /**
     * Экспорт отчетов
     */
    async exportReport(params: ExportParams) {
        const { reportType, format, parameters } = params;
        
        let reportData;
        
        // Получаем данные отчета
        switch (reportType) {
            case 'sales_by_month':
                reportData = await this.getSalesByMonth(parameters);
                break;
            case 'manager_activity':
                reportData = await this.getManagerActivity(parameters);
                break;
            case 'leads_by_source':
                reportData = await this.getLeadsBySource(parameters);
                break;
            case 'lead_conversion':
                reportData = await this.getLeadConversion(parameters);
                break;
            case 'sales_funnel':
                reportData = await this.getSalesFunnel(parameters);
                break;
            default:
                throw new Error(`Unknown report type: ${reportType}`);
        }

        // Экспортируем в нужный формат
        switch (format) {
            case 'csv':
                return await this.exportToCsv(reportData);
            case 'excel':
                return await this.exportToExcel(reportData);
            case 'pdf':
                return await this.exportToPdf(reportData);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    private async exportToCsv(reportData: any) {
        // Простая реализация CSV экспорта
        const headers = Object.keys(reportData.data[0] || {});
        let csvContent = headers.join(',') + '\\n';
        
        reportData.data.forEach((row: any) => {
            const values = headers.map(header => row[header] || '');
            csvContent += values.join(',') + '\\n';
        });
        
        return {
            data: Buffer.from(csvContent, 'utf8'),
            filename: `${reportData.reportName}_${Date.now()}.csv`,
            contentType: 'text/csv'
        };
    }

    private async exportToExcel(reportData: any) {
        // Здесь будет интеграция с библиотекой для Excel (например, exceljs)
        // Пока возвращаем JSON
        return {
            data: JSON.stringify(reportData, null, 2),
            filename: `${reportData.reportName}_${Date.now()}.json`,
            contentType: 'application/json'
        };
    }

    private async exportToPdf(reportData: any) {
        // Здесь будет интеграция с библиотекой для PDF (например, pdfkit)
        // Пока возвращаем JSON
        return {
            data: JSON.stringify(reportData, null, 2),
            filename: `${reportData.reportName}_${Date.now()}.json`,
            contentType: 'application/json'
        };
    }
}