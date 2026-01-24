import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { TracingService } from '../tracing/tracing.service';

export interface ServiceInstance {
  id: string;
  name: string;
  host: string;
  port: number;
  health: 'healthy' | 'unhealthy';
  lastHeartbeat: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class ServiceDiscoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServiceDiscoveryService.name);
  private redis: Redis;
  private readonly servicePrefix = 'service:';
  private readonly heartbeatInterval = 30000; // 30 seconds
  private heartbeatTimer: NodeJS.Timeout;

  constructor(private readonly tracingService: TracingService) {}

  async onModuleInit(): Promise<void> {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    // Start heartbeat
    this.startHeartbeat();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.redis) {
      await this.redis.quit();
    }
  }

  async registerService(service: Omit<ServiceInstance, 'lastHeartbeat'>): Promise<void> {
    const span = this.tracingService.startSpan('register-service');
    try {
      const serviceInstance: ServiceInstance = {
        ...service,
        lastHeartbeat: new Date(),
      };

      const key = `${this.servicePrefix}${service.name}:${service.id}`;
      await this.redis.setex(key, 120, JSON.stringify(serviceInstance)); // 2 minutes TTL

      this.logger.log(`Service registered: ${service.name} (${service.id})`);
    } catch (error) {
      this.logger.error(`Failed to register service ${service.name}`, error);
      throw error;
    } finally {
      this.tracingService.endSpan(span);
    }
  }

  async deregisterService(serviceName: string, serviceId: string): Promise<void> {
    const span = this.tracingService.startSpan('deregister-service');
    try {
      const key = `${this.servicePrefix}${serviceName}:${serviceId}`;
      await this.redis.del(key);
      this.logger.log(`Service deregistered: ${serviceName} (${serviceId})`);
    } catch (error) {
      this.logger.error(`Failed to deregister service ${serviceName}`, error);
      throw error;
    } finally {
      this.tracingService.endSpan(span);
    }
  }

  async getServiceInstances(serviceName: string): Promise<ServiceInstance[]> {
    const span = this.tracingService.startSpan('get-service-instances');
    try {
      const keys = await this.redis.keys(`${this.servicePrefix}${serviceName}:*`);
      const instances: ServiceInstance[] = [];

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          instances.push(JSON.parse(data));
        }
      }

      return instances.filter(instance => instance.health === 'healthy');
    } catch (error) {
      this.logger.error(`Failed to get service instances for ${serviceName}`, error);
      throw error;
    } finally {
      this.tracingService.endSpan(span);
    }
  }

  async updateHealth(serviceName: string, serviceId: string, health: 'healthy' | 'unhealthy'): Promise<void> {
    const span = this.tracingService.startSpan('update-service-health');
    try {
      const key = `${this.servicePrefix}${serviceName}:${serviceId}`;
      const data = await this.redis.get(key);

      if (data) {
        const instance: ServiceInstance = JSON.parse(data);
        instance.health = health;
        instance.lastHeartbeat = new Date();
        await this.redis.setex(key, 120, JSON.stringify(instance));
      }
    } catch (error) {
      this.logger.error(`Failed to update health for ${serviceName}:${serviceId}`, error);
      throw error;
    } finally {
      this.tracingService.endSpan(span);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      try {
        // This would be called by each service instance
        // For simplicity, we'll just log
        this.logger.debug('Heartbeat check');
      } catch (error) {
        this.logger.error('Heartbeat failed', error);
      }
    }, this.heartbeatInterval);
  }

  async getAllServices(): Promise<Record<string, ServiceInstance[]>> {
    const span = this.tracingService.startSpan('get-all-services');
    try {
      const keys = await this.redis.keys(`${this.servicePrefix}*`);
      const services: Record<string, ServiceInstance[]> = {};

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const instance: ServiceInstance = JSON.parse(data);
          if (!services[instance.name]) {
            services[instance.name] = [];
          }
          services[instance.name].push(instance);
        }
      }

      return services;
    } catch (error) {
      this.logger.error('Failed to get all services', error);
      throw error;
    } finally {
      this.tracingService.endSpan(span);
    }
  }
}
