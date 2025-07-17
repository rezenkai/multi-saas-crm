import winston from 'winston';
import { config } from '../config';

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, service = 'oauth2-service', ...meta }) => {
      const logMessage = stack || message;
      const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
      return `${timestamp} [${level.toUpperCase()}] ${service}: ${logMessage} ${metaString}`;
    })
  ),
  defaultMeta: { service: 'oauth2-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, stack, service = 'oauth2-service', ...meta }) => {
          const logMessage = stack || message;
          const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}] ${service}: ${logMessage} ${metaString}`;
        })
      )
    })
  ],
});

// Add file transport in production
if (config.environment === 'production') {
  logger.add(new winston.transports.File({ 
    filename: 'logs/oauth2-error.log', 
    level: 'error' 
  }));
  
  logger.add(new winston.transports.File({ 
    filename: 'logs/oauth2-combined.log' 
  }));
}

export { logger };