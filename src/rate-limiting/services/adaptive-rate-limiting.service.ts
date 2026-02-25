import { Injectable } from '@nestjs/common';
import * as os from 'os';

@Injectable()
export class AdaptiveRateLimitingService {
  getSystemLoadFactor(): number {
    const load = os.loadavg()[0]; // 1-minute average
    const cpuCount = os.cpus().length;

    const loadPercentage = load / cpuCount;

    if (loadPercentage > 0.9) return 0.5; // reduce limits by 50%
    if (loadPercentage > 0.7) return 0.7;
    return 1;
  }

  adjustLimit(baseLimit: number): number {
    const factor = this.getSystemLoadFactor();
    return Math.floor(baseLimit * factor);
  }
}