import fs from 'fs';
import path from 'path';
import { config } from '../config';

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  metadata?: any;
  requestId?: string;
  userId?: string;
  tenantId?: string;
}

class Logger {
  private logDir: string;
  private currentLogLevel: LogLevel;

  constructor() {
    this.logDir = process.env.LOG_DIR || '/app/logs';
    this.currentLogLevel = this.getLogLevel(process.env.LOG_LEVEL || 'INFO');
    this.ensureLogDirectory();
  }

  private getLogLevel(level: string): LogLevel {
    switch (level.toUpperCase()) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private formatLogEntry(level: string, message: string, metadata?: any, context?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...(metadata && { metadata }),
      ...(context?.requestId && { requestId: context.requestId }),
      ...(context?.userId && { userId: context.userId }),
      ...(context?.tenantId && { tenantId: context.tenantId })
    };
  }

  private writeToFile(filename: string, logEntry: LogEntry): void {
    try {
      const logPath = path.join(this.logDir, filename);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      fs.appendFileSync(logPath, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLogLevel;
  }

  private log(level: LogLevel, levelName: string, message: string, metadata?: any, context?: any): void {
    const logEntry = this.formatLogEntry(levelName, message, metadata, context);
    
    // Always log to console
    const consoleMessage = `[${logEntry.timestamp}] ${logEntry.level}: ${message}`;
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(consoleMessage, metadata || '');
        break;
      case LogLevel.WARN:
        console.warn(consoleMessage, metadata || '');
        break;
      case LogLevel.INFO:
        console.info(consoleMessage, metadata || '');
        break;
      case LogLevel.DEBUG:
        console.debug(consoleMessage, metadata || '');
        break;
    }

    if (!this.shouldLog(level)) {
      return;
    }

    // Write to appropriate log files
    const dateString = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // All logs go to main log file
    this.writeToFile(`analytics-${dateString}.log`, logEntry);
    
    // Error logs go to separate error file
    if (level === LogLevel.ERROR) {
      this.writeToFile(`errors-${dateString}.log`, logEntry);
    }
    
    // Audit logs for important actions
    if (metadata?.audit) {
      this.writeToFile(`audit-${dateString}.log`, logEntry);
    }
  }

  error(message: string, metadata?: any, context?: any): void {
    this.log(LogLevel.ERROR, 'ERROR', message, metadata, context);
  }

  warn(message: string, metadata?: any, context?: any): void {
    this.log(LogLevel.WARN, 'WARN', message, metadata, context);
  }

  info(message: string, metadata?: any, context?: any): void {
    this.log(LogLevel.INFO, 'INFO', message, metadata, context);
  }

  debug(message: string, metadata?: any, context?: any): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, metadata, context);
  }

  // Специальные методы для audit logging
  auditSuccess(action: string, details: any, context?: any): void {
    this.info(`AUDIT: ${action} - SUCCESS`, {
      ...details,
      audit: true,
      result: 'success'
    }, context);
  }

  auditFailure(action: string, error: any, context?: any): void {
    this.error(`AUDIT: ${action} - FAILURE`, {
      error: error.message || error,
      stack: error.stack,
      audit: true,
      result: 'failure'
    }, context);
  }

  // HTTP request logging
  logHttpRequest(req: any, res: any, duration: number, context?: any): void {
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection?.remoteAddress,
      contentLength: res.get('Content-Length'),
      audit: true
    };

    if (res.statusCode >= 400) {
      this.error(`HTTP ${req.method} ${req.url} - ${res.statusCode}`, logData, context);
    } else if (duration > 1000) {
      this.warn(`SLOW HTTP ${req.method} ${req.url} - ${duration}ms`, logData, context);
    } else {
      this.info(`HTTP ${req.method} ${req.url} - ${res.statusCode}`, logData, context);
    }
  }

  // Database operation logging
  logDatabaseOperation(operation: string, table: string, duration: number, context?: any): void {
    const logData = {
      operation,
      table,
      duration: `${duration}ms`,
      audit: true
    };

    if (duration > 5000) {
      this.warn(`SLOW DB ${operation} on ${table} - ${duration}ms`, logData, context);
    } else {
      this.debug(`DB ${operation} on ${table} - ${duration}ms`, logData, context);
    }
  }

  // Security event logging
  logSecurityEvent(event: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', details: any, context?: any): void {
    const logData = {
      securityEvent: event,
      severity,
      ...details,
      audit: true
    };

    if (severity === 'CRITICAL' || severity === 'HIGH') {
      this.error(`SECURITY: ${event} - ${severity}`, logData, context);
    } else {
      this.warn(`SECURITY: ${event} - ${severity}`, logData, context);
    }
  }

  // Performance monitoring
  logPerformance(operation: string, metrics: any, context?: any): void {
    this.info(`PERFORMANCE: ${operation}`, {
      ...metrics,
      audit: true
    }, context);
  }

  // Log rotation (should be called periodically)
  async rotateLogFiles(): Promise<void> {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime < thirtyDaysAgo) {
            // Compress old log files
            const compressedPath = `${filePath}.gz`;
            // Note: Would need zlib for actual compression
            this.info(`Log file marked for rotation: ${file}`);
          }
        }
      }
    } catch (error) {
      this.error('Failed to rotate log files', { error: error.message });
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Express middleware for request logging
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  // Generate request ID for tracing
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;
  
  // Extract context
  const context = {
    requestId,
    tenantId: req.get('X-Tenant-ID'),
    userId: req.user?.id || req.get('X-User-ID')
  };
  
  // Add context to request for use in controllers
  req.context = context;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logHttpRequest(req, res, duration, context);
  });
  
  next();
};