import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    tenant_id: string;
    role: string;
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({ error: 'No authorization header provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      // Add user information to request
      req.user = {
        id: decoded.user_id,
        email: decoded.email,
        tenant_id: decoded.tenant_id,
        role: decoded.role,
      };

      // Add user headers for downstream services
      req.headers['x-user-id'] = decoded.user_id;
      req.headers['x-user-email'] = decoded.email;
      req.headers['x-tenant-id'] = decoded.tenant_id;
      req.headers['x-user-role'] = decoded.role;

      logger.debug('User authenticated:', {
        user_id: decoded.user_id,
        email: decoded.email,
        tenant_id: decoded.tenant_id,
        role: decoded.role,
      });

      next();
    } catch (jwtError) {
      logger.error('JWT verification failed:', jwtError);
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
};