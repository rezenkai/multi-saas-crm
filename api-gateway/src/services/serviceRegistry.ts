import { config } from '../config';
import { logger } from '../utils/logger';

interface ServiceInfo {
  name: string;
  url: string;
  timeout: number;
  status: 'available' | 'unavailable' | 'unknown';
  lastCheck?: Date;
}

class ServiceRegistry {
  private services: Map<string, ServiceInfo> = new Map();

  constructor() {
    this.initializeServices();
    this.startHealthChecks();
  }

  private initializeServices(): void {
    // Register all services from config
    Object.entries(config.services).forEach(([name, serviceConfig]) => {
      this.services.set(name, {
        name,
        url: serviceConfig.url,
        timeout: serviceConfig.timeout,
        status: 'unknown',
      });
    });

    logger.info('Service registry initialized', {
      services: Array.from(this.services.keys()),
    });
  }

  public getService(name: string): ServiceInfo {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found in registry`);
    }
    return service;
  }

  public listServices(): ServiceInfo[] {
    return Array.from(this.services.values());
  }

  public registerService(name: string, url: string, timeout: number = 30000): void {
    this.services.set(name, {
      name,
      url,
      timeout,
      status: 'unknown',
    });
    
    logger.info(`Service '${name}' registered`, { url, timeout });
  }

  public unregisterService(name: string): void {
    this.services.delete(name);
    logger.info(`Service '${name}' unregistered`);
  }

  public updateServiceStatus(name: string, status: 'available' | 'unavailable'): void {
    const service = this.services.get(name);
    if (service) {
      service.status = status;
      service.lastCheck = new Date();
      
      if (status === 'unavailable') {
        logger.warn(`Service '${name}' is unavailable`, { url: service.url });
      } else {
        logger.debug(`Service '${name}' is available`, { url: service.url });
      }
    }
  }

  private async checkServiceHealth(service: ServiceInfo): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), service.timeout);

      const response = await fetch(`${service.url}/health`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      logger.debug(`Health check failed for service '${service.name}'`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: service.url,
      });
      return false;
    }
  }

  private startHealthChecks(): void {
    // Check service health every 30 seconds
    setInterval(async () => {
      for (const [name, service] of this.services) {
        const isHealthy = await this.checkServiceHealth(service);
        this.updateServiceStatus(name, isHealthy ? 'available' : 'unavailable');
      }
    }, 30000);

    // Initial health check
    setTimeout(() => {
      this.services.forEach(async (service, name) => {
        const isHealthy = await this.checkServiceHealth(service);
        this.updateServiceStatus(name, isHealthy ? 'available' : 'unavailable');
      });
    }, 5000);
  }

  public getServiceStatus(): Record<string, ServiceInfo> {
    const status: Record<string, ServiceInfo> = {};
    this.services.forEach((service, name) => {
      status[name] = { ...service };
    });
    return status;
  }
}

export const serviceRegistry = new ServiceRegistry();