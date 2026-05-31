import { Injectable } from '@nestjs/common';

export interface FraudSignal {
  type: string;
  severity: 'low' | 'medium' | 'high';
}

export interface FraudAssessment {
  isSuspicious: boolean;
  signals: FraudSignal[];
}

@Injectable()
export class FraudDetectionService {
  /**
   * Evaluates a request context for fraud signals.
   * Returns isSuspicious=true if any high-severity signal is found.
   */
  assess(context: {
    ipRequestCount: number;
    isNewDevice: boolean;
    amountUsd: number;
  }): FraudAssessment {
    const signals: FraudSignal[] = [];

    if (context.ipRequestCount > 100) {
      signals.push({ type: 'high_request_rate', severity: 'high' });
    }
    if (context.isNewDevice && context.amountUsd > 500) {
      signals.push({ type: 'new_device_large_amount', severity: 'medium' });
    }
    if (context.amountUsd > 10_000) {
      signals.push({ type: 'large_transaction', severity: 'high' });
    }

    return {
      isSuspicious: signals.some((s) => s.severity === 'high'),
      signals,
    };
  }
}