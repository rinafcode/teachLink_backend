import { Injectable } from '@nestjs/common';

@Injectable()
export class ServiceDiscoveryService {
  private registry: Map<string, string> = new Map();

  // Registered a service
  async registerService(name: string, address: string): Promise<void> {
    // TODO: Implement service registrations
    this.registry.set(name, address);
  }

  // Discovered a service
  async discoverService(name: string): Promise<string | undefined> {
    // TODO: Implement service discoverys
    return this.registry.get(name);
  }
} 