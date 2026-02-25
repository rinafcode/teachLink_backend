import { Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class ThreatDetectionService {
  private failedAttempts = new Map<string, number>();

  analyzeRequest(ip: string) {
    const attempts = this.failedAttempts.get(ip) || 0;

    if (attempts > 10) {
      throw new ForbiddenException('Suspicious activity detected');
    }
  }

  recordFailure(ip: string) {
    const attempts = this.failedAttempts.get(ip) || 0;
    this.failedAttempts.set(ip, attempts + 1);
  }

  reset(ip: string) {
    this.failedAttempts.delete(ip);
  }
}
