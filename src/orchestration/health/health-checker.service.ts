import { Injectable } from '@nestjs/common';
import { ServiceDiscoveryService } from '../discovery/service-discovery.service';
import axios from 'axios';

/**
 * Provides health Checker operations.
 */
@Injectable()
export class HealthCheckerService {
  constructor(private readonly discovery: ServiceDiscoveryService) {}

  /**
   * Validates check.
   * @param serviceName The service name.
   * @returns The operation result.
   */
  async check(serviceName: string) {
    const service = await this.discovery.getService(serviceName);

    try {
      await axios.get(`${service.baseUrl}/health`);
      return true;
    } catch {
      await this.discovery.markUnhealthy(serviceName);
      return false;
    }
}
