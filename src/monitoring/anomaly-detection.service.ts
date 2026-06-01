import { Injectable } from '@nestjs/common';

interface AnomalyResult {
  isAnomaly: boolean;
  score: number;
  reason?: string;
}

@Injectable()
export class AnomalyDetectionService {
  private readonly zScoreThreshold = 2.5;

  /**
   * Detects anomalies in a numeric series using Z-score.
   * Returns isAnomaly=true when the value deviates beyond the threshold.
   */
  detect(value: number, history: number[]): AnomalyResult {
    if (history.length < 2) {
      return { isAnomaly: false, score: 0 };
    }

    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const variance = history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return { isAnomaly: false, score: 0 };
    }

    const score = Math.abs(value - mean) / stdDev;
    const isAnomaly = score > this.zScoreThreshold;

    return {
      isAnomaly,
      score: parseFloat(score.toFixed(4)),
      ...(isAnomaly && { reason: `Z-score ${score.toFixed(2)} exceeds threshold ${this.zScoreThreshold}` }),
    };
  }
}