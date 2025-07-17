import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { logger } from '../utils/logger';
import { OAuth2Request, OAuthUser } from '../types/oauth';

// JWT Authentication middleware
export const authMiddleware = async (req: OAuth2Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
        error_description: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = jwt.verify(token, config.oauth2.jwtSecret) as any;
      
      // Reconstruct user object from JWT payload
      const user: OAuthUser = {
        id: decoded.sub,
        email: decoded.email,
        tenantId: decoded.tenant_id,
        profile: {
          name: decoded.name,
          avatar: decoded.picture
        },
        createdAt: new Date(decoded.iat * 1000),
        updatedAt: new Date()
      };

      req.user = user;
      
      logger.debug('User authenticated via JWT', { 
        userId: user.id, 
        tenantId: user.tenantId 
      });
      
      next();
    } catch (jwtError) {
      logger.warn('Invalid JWT token', { error: jwtError.message });
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid or expired access token'
      });
    }

  } catch (error) {
    logger.error('Authentication middleware error', { error });
    res.status(500).json({
      error: 'server_error',
      error_description: 'Authentication failed'
    });
  }
};

// OAuth2 Bearer token authentication middleware
export const oauthMiddleware = async (req: OAuth2Request, res: Response, next: NextFunction) => {
  try {
    // This would typically use the OAuth2 server's authenticate method
    // For now, we'll use JWT-based authentication
    await authMiddleware(req, res, next);
  } catch (error) {
    logger.error('OAuth middleware error', { error });
    res.status(500).json({
      error: 'server_error',
      error_description: 'OAuth authentication failed'
    });
  }
};

// Scope validation middleware
export const requireScope = (requiredScopes: string[]) => {
  return (req: OAuth2Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'unauthorized',
          error_description: 'Missing authorization header'
        });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, config.oauth2.jwtSecret) as any;
      
      const tokenScopes = decoded.scope || [];
      const hasRequiredScope = requiredScopes.some(scope => tokenScopes.includes(scope));
      
      if (!hasRequiredScope) {
        logger.warn('Insufficient scope', { 
          required: requiredScopes, 
          provided: tokenScopes,
          userId: decoded.sub 
        });
        
        return res.status(403).json({
          error: 'insufficient_scope',
          error_description: `Required scope: ${requiredScopes.join(' or ')}`
        });
      }

      next();
    } catch (error) {
      logger.error('Scope validation error', { error });
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid access token'
      });
    }
  };
};

// Client authentication middleware (for client credentials flow)
export const clientAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { client_id, client_secret } = req.body;
    
    if (!client_id || !client_secret) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Missing client credentials'
      });
    }

    // In production, validate against database
    // For demo, accept any non-empty credentials
    if (client_id.length > 0 && client_secret.length > 0) {
      req.client = {
        id: client_id,
        secret: client_secret,
        name: 'Demo Client'
      } as any;
      
      logger.debug('Client authenticated', { clientId: client_id });
      next();
    } else {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      });
    }

  } catch (error) {
    logger.error('Client authentication error', { error });
    res.status(500).json({
      error: 'server_error',
      error_description: 'Client authentication failed'
    });
  }
};

// Rate limiting middleware
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'too_many_requests',
    error_description: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({
      error: 'too_many_requests',
      error_description: 'Too many requests from this IP, please try again later.'
    });
  }
});

// CORS middleware for OAuth endpoints
export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  const allowedOrigins = config.security.corsOrigins;
  
  if (allowedOrigins.includes(origin || '')) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
};

// Tenant isolation middleware
export const tenantMiddleware = (req: OAuth2Request, res: Response, next: NextFunction) => {
  try {
    // Extract tenant ID from various sources
    let tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId && req.user) {
      tenantId = req.user.tenantId;
    }
    
    if (!tenantId) {
      tenantId = config.multiTenant.defaultTenantId;
    }

    req.tenant = {
      id: tenantId,
      name: `Tenant ${tenantId}`
    };

    logger.debug('Tenant resolved', { tenantId });
    next();
  } catch (error) {
    logger.error('Tenant middleware error', { error });
    res.status(500).json({
      error: 'server_error',
      error_description: 'Tenant resolution failed'
    });
  }
};