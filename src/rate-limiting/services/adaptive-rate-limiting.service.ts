import { Injectable } from '@nestjs/common';
import * as os from 'os';

/**
 * Provides adaptive Rate Limiting operations.
 */
@Injectable()
export class AdaptiveRateLimitingService {
  /**
   * Retrieves system Load Factor.
   * @returns The calculated numeric value.
   */
  getSystemLoadFactor(): number {
    const load = os.loadavg()[0]; // 1-minute average
    const cpuCount = os.cpus().length;

    const loadPercentage = load / cpuCount;

    if (loadPercentage > 0.9) return 0.5; // reduce limits by 50%
    if (loadPercentage > 0.7) return 0.7;
    return 1;
  }

  /**
   * Executes adjust Limit.
   * @param baseLimit The maximum number of results.
   * @returns The calculated numeric value.
   */
  adjustLimit(baseLimit: number): number {
    const factor = this.getSystemLoadFactor();
    return Math.floor(baseLimit * factor);
  }
}
