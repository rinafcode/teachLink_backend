import { Injectable } from '@nestjs/common';
import * as os from 'os';

@Injectable()
export class AdaptiveRateLimitingService {
  private cpuThreshold = 0.8; // 80%

  async isAllowed(userId: string, endpoint: string): Promise<boolean> {
    const load = os.loadavg()[0] / os.cpus().length;
    if (load > this.cpuThreshold) {
      // If system is under heavy load, restrict all but premium users
      return false;
    }
    return true;
  }
}
