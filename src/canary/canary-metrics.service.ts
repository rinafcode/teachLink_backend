import { Injectable, Logger } from '@nestjs/common';

export interface MirrorResult {
  path: string;
  method: string;
  statusCode: number;
  durationMs: number;
  success: boolean;
}

export interface CanaryStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  averageDurationMs: number;
  successRate: number;
}

@Injectable()
export class CanaryMetricsService {
  private readonly logger = new Logger(CanaryMetricsService.name);
  private readonly results: MirrorResult[] = [];

  private readonly promoteThreshold = parseFloat(
    process.env.CANARY_PROMOTE_THRESHOLD || '0.95',
  );
  private readonly rollbackThreshold = parseFloat(
    process.env.CANARY_ROLLBACK_THRESHOLD || '0.70',
  );
  private readonly minSampleSize = parseInt(
    process.env.CANARY_MIN_SAMPLE_SIZE || '20',
    10,
  );

  recordMirrorResult(result: MirrorResult): void {
    this.results.push(result);
    this.logger.debug(
      `Mirror [${result.method} ${result.path}] → ${result.statusCode} in ${result.durationMs}ms`,
    );
    this.evaluateCanary();
  }

  getStats(): CanaryStats {
    const total = this.results.length;
    if (total === 0) {
      return {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        averageDurationMs: 0,
        successRate: 0,
      };
    }

    const successCount = this.results.filter((r) => r.success).length;
    const failureCount = total - successCount;
    const averageDurationMs =
      this.results.reduce((sum, r) => sum + r.durationMs, 0) / total;
    const successRate = successCount / total;

    return {
      totalRequests: total,
      successCount,
      failureCount,
      averageDurationMs: Math.round(averageDurationMs),
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  private evaluateCanary(): void {
    const stats = this.getStats();

    if (stats.totalRequests < this.minSampleSize) {
      return;
    }

    if (stats.successRate >= this.promoteThreshold) {
      this.logger.log(
        `Canary PROMOTE signal: success rate ${stats.successRate} >= ${this.promoteThreshold} ` +
          `over ${stats.totalRequests} requests.`,
      );
      return;
    }

    if (stats.successRate < this.rollbackThreshold) {
      this.logger.error(
        `Canary ROLLBACK signal: success rate ${stats.successRate} < ${this.rollbackThreshold} ` +
          `over ${stats.totalRequests} requests.`,
      );
    }
  }
}