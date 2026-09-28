import { Injectable } from '@nestjs/common';
import { ContainerCpuMetricsService } from './container-cpu-metrics.service';

/**
 * Provides adaptive Rate Limiting operations.
 */
@Injectable()
export class AdaptiveRateLimitingService {
  constructor(private readonly cpuMetrics: ContainerCpuMetricsService) {}
  /**
   * Retrieves system Load Factor.
   * @returns The calculated numeric value.
   */
  async getSystemLoadFactor(): Promise<number> {
    const loadPercentage = await this.cpuMetrics.getCpuLoadRatio();

    if (loadPercentage > 0.9) return 0.5; // reduce limits by 50%
    if (loadPercentage > 0.7) return 0.7;
    return 1;
  }

  /**
   * Executes adjust Limit.
   * @param baseLimit The maximum number of results.
   * @returns The calculated numeric value.
   */
  async adjustLimit(baseLimit: number): Promise<number> {
    const factor = await this.getSystemLoadFactor();
    return Math.floor(baseLimit * factor);
  }
}
