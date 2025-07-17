import { Router, Request, Response } from 'express';
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
    service: 'plugins-system',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  };

  res.json(health);
});

export const healthRoutes = router;