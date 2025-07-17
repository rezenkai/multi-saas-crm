import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface TenantRequest extends Request {
  tenant?: {
    id: string;
    name: string;
    status: string;
  };
}

export const tenantMiddleware = (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    // Get tenant ID from various sources
    let tenantId: string | undefined;
    
    // 1. From JWT token (preferred)
    if (req.user?.tenant_id) {
      tenantId = req.user.tenant_id;
    }
    
    // 2. From X-Tenant-ID header
    if (!tenantId) {
      tenantId = req.headers['x-tenant-id'] as string;
    }
    
    // 3. From subdomain (if using subdomain-based tenancy)
    if (!tenantId && req.headers.host) {
      const subdomain = req.headers.host.split('.')[0];
      if (subdomain && subdomain !== 'localhost' && subdomain !== 'api') {
        tenantId = subdomain;
      }
    }
    
    // 4. From query parameter (fallback)
    if (!tenantId && req.query.tenant_id) {
      tenantId = req.query.tenant_id as string;
    }
    
    if (tenantId) {
      // In a real implementation, you would validate the tenant exists
      // and get tenant details from database
      req.tenant = {
        id: tenantId,
        name: `Tenant ${tenantId}`,
        status: 'active'
      };
      
      logger.debug(`Request processed for tenant: ${tenantId}`);
    }
    
    next();
  } catch (error) {
    logger.error('Tenant middleware error:', error);
    return res.status(500).json({ error: 'Tenant processing error' });
  }
};