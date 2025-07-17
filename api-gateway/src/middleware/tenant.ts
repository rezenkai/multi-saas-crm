import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface TenantRequest extends Request {
  tenant?: {
    id: string;
    name: string;
    status: string;
  };
}

export const tenantMiddleware = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract tenant information from headers or subdomain
    const tenantId = req.headers['x-tenant-id'] as string;
    const subdomain = req.headers['x-tenant-subdomain'] as string;
    
    if (tenantId || subdomain) {
      // In a real implementation, you would fetch tenant info from database
      // For now, we'll use the tenant_id from JWT token
      req.tenant = {
        id: tenantId || 'default',
        name: subdomain || 'default',
        status: 'active',
      };

      // Add tenant headers for downstream services
      req.headers['x-tenant-id'] = req.tenant.id;
      req.headers['x-tenant-name'] = req.tenant.name;
      req.headers['x-tenant-status'] = req.tenant.status;

      logger.debug('Tenant context set:', {
        tenant_id: req.tenant.id,
        tenant_name: req.tenant.name,
        tenant_status: req.tenant.status,
      });
    }

    next();
  } catch (error) {
    logger.error('Tenant middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
};