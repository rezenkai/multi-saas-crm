import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface OAuth2ErrorResponse {
  error: string;
  error_description?: string;
  error_uri?: string;
  state?: string;
}

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('OAuth2 Service error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // OAuth2 specific errors
  if (error.name === 'InvalidClientError') {
    return res.status(401).json({
      error: 'invalid_client',
      error_description: error.message || 'Invalid client credentials'
    } as OAuth2ErrorResponse);
  }

  if (error.name === 'InvalidGrantError') {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: error.message || 'Invalid authorization grant'
    } as OAuth2ErrorResponse);
  }

  if (error.name === 'InvalidRequestError') {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: error.message || 'Invalid request parameters'
    } as OAuth2ErrorResponse);
  }

  if (error.name === 'InvalidScopeError') {
    return res.status(400).json({
      error: 'invalid_scope',
      error_description: error.message || 'Invalid or unsupported scope'
    } as OAuth2ErrorResponse);
  }

  if (error.name === 'UnsupportedGrantTypeError') {
    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: error.message || 'Unsupported grant type'
    } as OAuth2ErrorResponse);
  }

  if (error.name === 'UnsupportedResponseTypeError') {
    return res.status(400).json({
      error: 'unsupported_response_type',
      error_description: error.message || 'Unsupported response type'
    } as OAuth2ErrorResponse);
  }

  if (error.name === 'AccessDeniedError') {
    return res.status(403).json({
      error: 'access_denied',
      error_description: error.message || 'Access denied'
    } as OAuth2ErrorResponse);
  }

  if (error.name === 'ServerError') {
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    } as OAuth2ErrorResponse);
  }

  // JWT specific errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Invalid access token'
    } as OAuth2ErrorResponse);
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Access token expired'
    } as OAuth2ErrorResponse);
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: error.message || 'Request validation failed'
    } as OAuth2ErrorResponse);
  }

  // Database errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return res.status(503).json({
      error: 'temporarily_unavailable',
      error_description: 'Service temporarily unavailable'
    } as OAuth2ErrorResponse);
  }

  // Rate limiting errors
  if (error.name === 'TooManyRequestsError') {
    return res.status(429).json({
      error: 'temporarily_unavailable',
      error_description: 'Too many requests'
    } as OAuth2ErrorResponse);
  }

  // Default error response
  const status = error.statusCode || error.status || 500;
  const message = status === 500 ? 'Internal server error' : error.message;

  res.status(status).json({
    error: status >= 500 ? 'server_error' : 'invalid_request',
    error_description: message
  } as OAuth2ErrorResponse);
};

// 404 handler for unknown routes
export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn('Route not found', {
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    error: 'invalid_request',
    error_description: 'Endpoint not found'
  } as OAuth2ErrorResponse);
};