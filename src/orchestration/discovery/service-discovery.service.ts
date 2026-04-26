import { Injectable } from '@nestjs/common';

interface IRegisteredService {
  name: string;
  baseUrl: string;
  healthy: boolean;
}

@Injectable()
export class ServiceDiscoveryService {
  private services = new Map<string, IRegisteredService>();

  register(service: IRegisteredService) {
    this.services.set(service.name, service);
  }

  async getService(name: string): Promise<IRegisteredService> {
    const service = this.services.get(name);
    if (!service || !service.healthy) {
      throw new Error(`Service ${name} unavailable`);
    }
    return service;
  }

  async markUnhealthy(name: string) {
    const service = this.services.get(name);
    if (service) {
      service.healthy = false;
    }
  }
}
