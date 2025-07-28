import { Router } from 'express';
import { CrmAnalyticsController } from './CrmAnalyticsController';

export function crmAnalyticsRoutes(): Router {
    const router = Router();
    const controller = new CrmAnalyticsController();

    // Стандартные отчеты из ТЗ
    router.get('/sales-by-month', controller.getSalesByMonth.bind(controller));
    router.get('/manager-activity', controller.getManagerActivity.bind(controller));
    router.get('/leads-by-source', controller.getLeadsBySource.bind(controller));
    router.get('/lead-conversion', controller.getLeadConversion.bind(controller));
    router.get('/sales-funnel', controller.getSalesFunnel.bind(controller));

    // Утилиты
    router.get('/reports', controller.getAvailableReports.bind(controller));
    router.post('/export', controller.exportReport.bind(controller));

    return router;
}