import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'healthy',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total:
          Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
      },
      channels: {
        email: 'stub mode',
        sms: 'stub mode',
        telegram: 'stub mode',
        whatsapp: 'stub mode',
        push: 'stub mode',
      },
    };
  }

  getRoot() {
    return {
      service: 'notification-service',
      version: '1.0.0',
      status: 'running',
      description: 'Multi-channel Notification Service for Multi-SaaS Platform',
      mode: 'STUB MODE - All channels are simulated',
      endpoints: {
        health: '/api/v1/health',
        notifications: '/api/v1/notifications',
        channels: '/api/v1/notifications/channels',
      },
      channels: ['email', 'sms', 'telegram', 'whatsapp', 'push'],
      features: [
        'Multi-channel notifications (STUB)',
        'Template support (STUB)',
        'Delivery simulation',
        'Error handling',
        'Status tracking',
      ],
      unifiedApi: {
        endpoint: 'POST /api/v1/notifications/send',
        example: {
          to: 'user@example.com',
          channels: ['email', 'telegram', 'sms'],
          template: 'opportunity_created',
          data: { opportunityName: 'Big Deal' },
        },
      },
    };
  }
}
