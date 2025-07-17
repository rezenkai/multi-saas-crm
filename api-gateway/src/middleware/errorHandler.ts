import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
}

export const errorHandler = (
  err: ErrorWithStatus,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    status,
    method: req.method,
    url: req.url,
    requestId: (req as any).requestId,
    tenant_id: req.headers['x-tenant-id'],
    user_id: req.headers['x-user-id'],
  });

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorResponse = {
    error: message,
    status,
    ...(isDevelopment && { stack: err.stack }),
    requestId: (req as any).requestId,
  };

  res.status(status).json(errorResponse);
};