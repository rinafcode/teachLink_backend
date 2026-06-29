import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FraudSignal {
  type: string;
  severity: 'low' | 'medium' | 'high';
}

export interface FraudAssessment {
  isSuspicious: boolean;
  signals: FraudSignal[];
}

export interface FraudContext {
  ipRequestCount: number;
  isNewDevice: boolean;
  amountUsd: number;
  /** Purchases made by the user in the current sliding hour window */
  purchasesPerHour?: number;
  /** ISO-3166-1 alpha-2 country of the current request (from IP geolocation) */
  requestCountry?: string;
  /** ISO-3166-1 alpha-2 country stored in the user's registration profile */
  registrationCountry?: string;
}

/** Pluggable signal provider interface */
export interface FraudSignalProvider {
  evaluate(context: FraudContext): FraudSignal[];
}

/** Emits a high-severity signal when the IP request rate is too high */
@Injectable()
export class IpRateSignalProvider implements FraudSignalProvider {
  constructor(private readonly threshold: number) {}

  evaluate(ctx: FraudContext): FraudSignal[] {
    if (ctx.ipRequestCount > this.threshold) {
      return [{ type: 'high_request_rate', severity: 'high' }];
    }
    return [];
  }
}

/** Emits a medium-severity signal for large purchases from unrecognised devices */
@Injectable()
export class NewDeviceSignalProvider implements FraudSignalProvider {
  constructor(private readonly amountThreshold: number) {}

  evaluate(ctx: FraudContext): FraudSignal[] {
    if (ctx.isNewDevice && ctx.amountUsd > this.amountThreshold) {
      return [{ type: 'new_device_large_amount', severity: 'medium' }];
    }
    return [];
  }
}

/** Emits a high-severity signal for unusually large individual transactions */
@Injectable()
export class LargeTransactionSignalProvider implements FraudSignalProvider {
  constructor(private readonly threshold: number) {}

  evaluate(ctx: FraudContext): FraudSignal[] {
    if (ctx.amountUsd > this.threshold) {
      return [{ type: 'large_transaction', severity: 'high' }];
    }
    return [];
  }
}

/**
 * Velocity signal: emits high-severity when a user exceeds N purchases/hour.
 * Backed by a Redis sliding-window counter in production; the counter value
 * is provided externally via `FraudContext.purchasesPerHour`.
 */
@Injectable()
export class VelocitySignalProvider implements FraudSignalProvider {
  constructor(private readonly maxPurchasesPerHour: number) {}

  evaluate(ctx: FraudContext): FraudSignal[] {
    if (ctx.purchasesPerHour !== undefined && ctx.purchasesPerHour > this.maxPurchasesPerHour) {
      return [{ type: 'velocity_exceeded', severity: 'high' }];
    }
    return [];
  }
}

/**
 * Geolocation anomaly signal: emits medium-severity when the purchase country
 * differs from the user's registration country.
 */
@Injectable()
export class GeoAnomalySignalProvider implements FraudSignalProvider {
  evaluate(ctx: FraudContext): FraudSignal[] {
    if (
      ctx.requestCountry &&
      ctx.registrationCountry &&
      ctx.requestCountry !== ctx.registrationCountry
    ) {
      return [{ type: 'geo_anomaly', severity: 'medium' }];
    }
    return [];
  }
}

/**
 * Aggregates signals from all registered providers.
 * Thresholds are read from ConfigService so they can be changed without
 * code modifications.
 */
@Injectable()
export class FraudDetectionService {
  private readonly providers: FraudSignalProvider[];

  constructor(private readonly configService: ConfigService) {
    this.providers = [
      new IpRateSignalProvider(
        this.configService.get<number>('FRAUD_IP_RATE_THRESHOLD', 100),
      ),
      new NewDeviceSignalProvider(
        this.configService.get<number>('FRAUD_NEW_DEVICE_AMOUNT_THRESHOLD', 500),
      ),
      new LargeTransactionSignalProvider(
        this.configService.get<number>('FRAUD_LARGE_TX_THRESHOLD', 10_000),
      ),
      new VelocitySignalProvider(
        this.configService.get<number>('FRAUD_MAX_PURCHASES_PER_HOUR', 10),
      ),
      new GeoAnomalySignalProvider(),
    ];
  }

  /**
   * Evaluates a request context for fraud signals by aggregating all providers.
   * Returns isSuspicious=true if any high-severity signal is found.
   */
  assess(context: FraudContext): FraudAssessment {
    const signals = this.providers.flatMap((p) => p.evaluate(context));
    return {
      isSuspicious: signals.some((s) => s.severity === 'high'),
      signals,
    };
  }
}
