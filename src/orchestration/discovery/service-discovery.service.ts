import { Injectable } from '@nestjs/common';
import {
  SERVICE_BOUNDARIES,
  IServiceBoundaryDefinition,
  findBoundaryByRoute,
} from './service-boundaries';

export interface IRegisteredService {
  id: string;
  name: string;
  baseUrl: string;
  healthy: boolean;
  boundary: IServiceBoundaryDefinition;
  metadata?: Record<string, unknown>;
}

interface IRegisterServiceInput extends Omit<IRegisteredService, 'boundary'> {
  boundary?: IServiceBoundaryDefinition;
}

/**
 * Provides service Discovery operations.
 */
@Injectable()
export class ServiceDiscoveryService {
  private readonly services = new Map<string, IRegisteredService[]>();
  private readonly cursors = new Map<string, number>();
  private readonly boundaries = new Map<string, IServiceBoundaryDefinition>(
    Object.values(SERVICE_BOUNDARIES).map((boundary) => [boundary.serviceName, boundary]),
  );

  register(service: IRegisterServiceInput): IRegisteredService {
    const boundary = service.boundary ?? this.getServiceBoundary(service.name);
    const instances = this.services.get(service.name) ?? [];
    const nextInstance: IRegisteredService = {
      ...service,
      healthy: service.healthy ?? true,
      boundary,
    };

    const index = instances.findIndex((instance) => instance.id === service.id);
    if (index >= 0) {
      instances[index] = nextInstance;
    } else {
      instances.push(nextInstance);
    }

    this.services.set(service.name, instances);
    return nextInstance;
  }

  registerBoundary(boundary: IServiceBoundaryDefinition): void {
    this.boundaries.set(boundary.serviceName, boundary);
  }

  async getService(name: string): Promise<IRegisteredService> {
    return this.selectServiceInstance(name);
  }

  async resolveService(nameOrPath: string, path?: string): Promise<IRegisteredService> {
    if (this.boundaries.has(nameOrPath) || this.services.has(nameOrPath)) {
      return this.getService(nameOrPath);
    }

    const resolvedPath = path ?? nameOrPath;
    const discovered = await this.discoverByRoute(resolvedPath);
    return discovered;
  }

  async discoverByRoute(path: string): Promise<IRegisteredService> {
    const boundary = findBoundaryByRoute(path);
    if (!boundary) {
      throw new Error(`No service boundary owns route ${path}`);
    }

    return this.getService(boundary.serviceName);
  }

  async markUnhealthy(name: string, serviceId?: string): Promise<void> {
    this.updateHealth(name, false, serviceId);
  }

  async markHealthy(name: string, serviceId?: string): Promise<void> {
    this.updateHealth(name, true, serviceId);
  }

  async getAllServices(): Promise<Record<string, IRegisteredService[]>> {
    return Object.fromEntries(this.services.entries());
  }

  getServiceBoundary(name: string): IServiceBoundaryDefinition {
    const boundary = this.boundaries.get(name);
    if (boundary) {
      return boundary;
    }

    const adHocBoundary: IServiceBoundaryDefinition = {
      serviceName: name,
      domain: 'platform',
      description: `Ad hoc boundary inferred for ${name}.`,
      routePrefixes: [`/${name}`],
      dependencies: [],
      communicationMode: 'sync',
    };
    this.boundaries.set(name, adHocBoundary);
    return adHocBoundary;
  }

  listBoundaries(): IServiceBoundaryDefinition[] {
    return Array.from(this.boundaries.values());
  }

  private selectServiceInstance(name: string): IRegisteredService {
    const instances = (this.services.get(name) ?? []).filter((instance) => instance.healthy);
    if (instances.length === 0) {
      return this.createLocalFallback(name);
    }

    const nextIndex = this.cursors.get(name) ?? 0;
    const selected = instances[nextIndex % instances.length];
    this.cursors.set(name, (nextIndex + 1) % instances.length);
    return selected;
  }

  private updateHealth(name: string, healthy: boolean, serviceId?: string): void {
    const instances = this.services.get(name);
    if (!instances) {
      return;
    }

    const nextInstances = instances.map((instance) => {
      if (serviceId && instance.id !== serviceId) {
        return instance;
      }

      return {
        ...instance,
        healthy,
      };
    });

    this.services.set(name, nextInstances);
  }

  private createLocalFallback(name: string): IRegisteredService {
    const boundary = this.getServiceBoundary(name);
    const envKey = `${name.replace(/-/g, '_').toUpperCase()}_SERVICE_URL`;

    return {
      id: `${name}-local`,
      name,
      baseUrl: process.env[envKey] || 'http://localhost:3000',
      healthy: true,
      boundary,
      metadata: {
        source: 'co-located-fallback',
      },
    };
  }
}
