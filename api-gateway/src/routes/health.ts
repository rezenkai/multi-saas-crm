import { Router, Request, Response } from 'express';
import { serviceRegistry } from '../services/serviceRegistry';
import { logger } from '../utils/logger';

const router = Router();

// Health check endpoint
router.get('/', (req: Request, res: Response) => {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();
  
  const health = {
    status: 'healthy',
    timestamp,
    uptime,
    service: 'api-gateway',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  };

  res.json(health);
});

// Detailed health check with service status
router.get('/detailed', (req: Request, res: Response) => {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();
  const services = serviceRegistry.getServiceStatus();
  
  const unavailableServices = Object.values(services)
    .filter(service => service.status === 'unavailable');
  
  const overallStatus = unavailableServices.length > 0 ? 'degraded' : 'healthy';
  
  const health = {
    status: overallStatus,
    timestamp,
    uptime,
    service: 'api-gateway',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services,
    issues: unavailableServices.map(service => ({
      service: service.name,
      status: service.status,
      lastCheck: service.lastCheck,
    })),
  };

  const statusCode = overallStatus === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Service-specific health check
router.get('/service/:serviceName', (req: Request, res: Response) => {
  try {
    const serviceName = req.params.serviceName;
    const service = serviceRegistry.getService(serviceName);
    
    res.json({
      service: serviceName,
      status: service.status,
      url: service.url,
      lastCheck: service.lastCheck,
      timeout: service.timeout,
    });
  } catch (error) {
    logger.error('Service health check error:', error);
    res.status(404).json({
      error: 'Service not found',
      service: req.params.serviceName,
    });
  }
});

export const healthCheck = router;