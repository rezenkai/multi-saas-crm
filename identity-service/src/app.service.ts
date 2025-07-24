import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'healthy',
      service: 'identity-service',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      database: 'connected', // We can add actual DB health check later
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total:
          Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
      },
    };
  }

  getRoot() {
    return {
      service: 'identity-service',
      version: '1.0.0',
      status: 'running',
      description:
        'Identity Service with Auth0 Integration for Multi-SaaS Platform',
      endpoints: {
        health: '/api/v1/health',
        users: '/api/v1/users',
        auth: '/api/v1/auth',
        twoFactor: '/api/v1/auth/2fa',
        auth0: '/api/v1/auth/auth0',
        docs: '/api/v1/docs', // For future Swagger documentation
      },
      features: [
        'User Management',
        'Password Authentication',
        'Two-Factor Authentication (2FA)',
        'Auth0 SSO Integration',
        'Enterprise Connections',
        'JWT Token Management',
        'Multi-tenant Support',
      ],
      auth0: {
        login: '/api/v1/auth/auth0/login',
        callback: '/api/v1/auth/auth0/callback',
        logout: '/api/v1/auth/auth0/logout',
        status: '/api/v1/auth/auth0/status',
      },
    };
  }
}
