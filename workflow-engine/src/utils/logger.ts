import winston from 'winston';
import { config } from '../config';

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, service = 'workflow-engine', ...meta }) => {
      const logMessage = stack || message;
      const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
      return `${timestamp} [${service}] ${level.toUpperCase()}: ${logMessage} ${metaString}`;
    })
  ),
  defaultMeta: { service: 'workflow-engine' },
  transports: []
});

// Console transport
if (config.logging.enableConsole) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// File transport
if (config.logging.enableFile) {
  logger.add(new winston.transports.File({
    filename: config.logging.fileConfig.filename,
    maxsize: parseInt(config.logging.fileConfig.maxSize.replace(/\D/g, '')) * 1024 * 1024,
    maxFiles: config.logging.fileConfig.maxFiles,
    tailable: true
  }));
}

export { logger };