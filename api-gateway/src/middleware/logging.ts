import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface LoggingRequest extends Request {
  requestId?: string;
  startTime?: number;
}

export const loggingMiddleware = (
  req: LoggingRequest,
  res: Response,
  next: NextFunction
): void => {
  // Generate unique request ID
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Add request ID to headers for downstream services
  req.headers['x-request-id'] = req.requestId;

  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    tenant_id: req.headers['x-tenant-id'],
    user_id: req.headers['x-user-id'],
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
    const duration = Date.now() - (req.startTime || 0);
    
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      tenant_id: req.headers['x-tenant-id'],
      user_id: req.headers['x-user-id'],
    });

    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};