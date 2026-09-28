import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface AnomalyResult {
  isAnomaly: boolean;
  score: number;
  reason?: string;
}

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);
  private readonly zScoreThreshold: number;
  private readonly minSampleCount: number;
  private readonly hysteresis: number;

  constructor(private readonly configService: ConfigService) {
    this.zScoreThreshold = this.getNumberConfig('ANOMALY_ZSCORE_THRESHOLD', 2.5);
    this.minSampleCount = this.getNumberConfig('ANOMALY_MIN_SAMPLE_COUNT', 2);
    this.hysteresis = this.getNumberConfig('ANOMALY_HYSTERESIS', 0.2);
  }

  /**
   * Detects anomalies in a numeric series using Z-score.
   * Returns isAnomaly=true when the value deviates beyond the threshold.
   */
  detect(value: number, history: number[]): AnomalyResult {
    if (!Array.isArray(history) || history.length < this.minSampleCount) {
      return { isAnomaly: false, score: 0 };
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this.logger.warn('Invalid anomaly score input received');
      return { isAnomaly: false, score: 0 };
    }

    const hasValidHistory = history.every(
      (item) => typeof item === 'number' && Number.isFinite(item),
    );
    if (!hasValidHistory) {
      this.logger.warn('Invalid anomaly history values received');
      return { isAnomaly: false, score: 0 };
    }

    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const variance = history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return { isAnomaly: false, score: 0 };
    }

    const score = Math.abs(value - mean) / stdDev;
    if (!Number.isFinite(score)) {
      this.logger.warn('Anomaly score became invalid during evaluation');
      return { isAnomaly: false, score: 0 };
    }

    const effectiveThreshold = this.zScoreThreshold + this.hysteresis;
    const isAnomaly = score > effectiveThreshold;

    return {
      isAnomaly,
      score: parseFloat(score.toFixed(4)),
      ...(isAnomaly && {
        reason: `Z-score ${score.toFixed(2)} exceeds threshold ${effectiveThreshold.toFixed(2)}`,
      }),
    };
  }

  private getNumberConfig(key: string, fallback: number): number {
    const value = this.configService.get<string | number>(key, fallback);
    const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
