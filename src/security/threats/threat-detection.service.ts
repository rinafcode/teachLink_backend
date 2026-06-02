import { Injectable } from '@nestjs/common';
import { ForbiddenOperationException } from '../../common/exceptions/app.exceptions';

/**
 * Provides threat Detection operations.
 */
@Injectable()
export class ThreatDetectionService {
  private failedAttempts = new Map<string, number>();
  analyzeRequest(ip: string): void {
    const attempts = this.failedAttempts.get(ip) || 0;
    if (attempts > 10) {
      throw new ForbiddenOperationException('Suspicious activity detected');
    }
  }
  recordFailure(ip: string): void {
    const attempts = this.failedAttempts.get(ip) || 0;
    this.failedAttempts.set(ip, attempts + 1);
  }
  reset(ip: string): void {
    this.failedAttempts.delete(ip);
  }
}
