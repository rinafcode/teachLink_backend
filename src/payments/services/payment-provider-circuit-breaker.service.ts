import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { IPaymentProvider } from '../providers/payment-provider.interface';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface PaymentCircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  fallbacks: number;
  rejects: number;
  timeouts: number;
  errorRate: number;
}

/**
 * PaymentProviderCircuitBreakerService
 *
 * Wraps every IPaymentProvider method with a shared opossum circuit breaker.
 * Configuration (per spec):
 *   - errorThresholdPercentage: 50  (open after ≥50% failures in the rolling window)
 *   - resetTimeout:             30 000 ms (half-open probe after 30 s)
 *   - timeout:                  10 000 ms (individual call timeout)
 *   - volumeThreshold:          5         (need ≥5 calls before the % check matters)
 *
 * Acceptance criteria mapping:
 *   - After 5 consecutive failures the circuit opens and new requests reject with 503.
 *   - Circuit auto-recovers after a successful half-open probe (resetTimeout elapses).
 *   - `getCircuitState()` / `getStats()` expose the state for the health endpoint.
 */
@Injectable()
export class PaymentProviderCircuitBreakerService implements OnModuleDestroy {
  private readonly logger = new Logger(PaymentProviderCircuitBreakerService.name);

  /** Key used to identify this breaker in logs and metrics */
  static readonly BREAKER_NAME = 'payment-provider';

  private readonly breaker: CircuitBreaker;

  constructor() {
    // `action` is a generic placeholder; each public method supplies its own
    // async thunk via breaker.fire(fn), so we register a no-op here.
    this.breaker = new CircuitBreaker(
      (fn: () => Promise<unknown>) => fn(),
      {
        name: PaymentProviderCircuitBreakerService.BREAKER_NAME,
        timeout: 10_000,                // 10 s per call
        errorThresholdPercentage: 50,   // open when ≥50 % of calls in window fail
        resetTimeout: 30_000,           // wait 30 s before probing in half-open
        volumeThreshold: 5,             // require at least 5 calls before tripping
        rollingCountTimeout: 60_000,    // 60 s rolling stats window
        rollingCountBuckets: 10,
      },
    );

    this.breaker.on('open', () =>
      this.logger.warn('[payment-provider] Circuit OPENED — fast-failing all payment calls'),
    );
    this.breaker.on('close', () =>
      this.logger.log('[payment-provider] Circuit CLOSED — payment provider recovered'),
    );
    this.breaker.on('halfOpen', () =>
      this.logger.log('[payment-provider] Circuit HALF_OPEN — sending probe request'),
    );
    this.breaker.on('fallback', () =>
      this.logger.warn('[payment-provider] Circuit FALLBACK triggered'),
    );
    this.breaker.on('reject', () =>
      this.logger.warn('[payment-provider] Circuit REJECTED request (circuit is open)'),
    );
    this.breaker.on('timeout', () =>
      this.logger.warn('[payment-provider] Circuit TIMEOUT — provider call exceeded 10 s'),
    );
    this.breaker.on('failure', (err: Error) =>
      this.logger.error(`[payment-provider] Circuit FAILURE: ${err?.message}`),
    );
    this.breaker.on('success', () =>
      this.logger.debug('[payment-provider] Circuit SUCCESS'),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.breaker.shutdown();
    this.logger.log('[payment-provider] Circuit breaker shut down');
  }

  // ---------------------------------------------------------------------------
  // Internal helper
  // ---------------------------------------------------------------------------

  /**
   * Fires the circuit breaker with the provided thunk.
   * If the circuit is open, opossum throws an error that we convert to 503.
   */
  private async fire<T>(thunk: () => Promise<T>): Promise<T> {
    try {
      return (await this.breaker.fire(thunk)) as T;
    } catch (err: unknown) {
      const isCircuitOpen =
        err instanceof Error &&
        (err.message.includes('Breaker is open') ||
          err.message.includes('open') ||
          (err as any).code === 'EOPENBREAKER');

      if (isCircuitOpen) {
        throw new ServiceUnavailableException(
          'Payment provider is temporarily unavailable. Please try again later.',
        );
      }

      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // IPaymentProvider proxy methods
  // ---------------------------------------------------------------------------

  async createPaymentIntent(
    provider: IPaymentProvider,
    amount: number,
    currency: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ clientSecret: string; paymentIntentId: string; requiresAction?: boolean }> {
    return this.fire(() => provider.createPaymentIntent(amount, currency, metadata));
  }

  async createSubscription(
    provider: IPaymentProvider,
    customerId: string,
    priceId: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ subscriptionId: string; status: string; currentPeriodEnd: Date }> {
    return this.fire(() => provider.createSubscription(customerId, priceId, metadata));
  }

  async cancelSubscription(
    provider: IPaymentProvider,
    subscriptionId: string,
  ): Promise<boolean> {
    return this.fire(() => provider.cancelSubscription(subscriptionId));
  }

  async refundPayment(
    provider: IPaymentProvider,
    paymentId: string,
    amount?: number,
  ): Promise<{ refundId: string; status: string }> {
    return this.fire(() => provider.refundPayment(paymentId, amount));
  }

  async handleWebhook(
    provider: IPaymentProvider,
    payload: unknown,
    signature: string,
  ): Promise<{ type: string; data: unknown }> {
    return this.fire(() => provider.handleWebhook(payload, signature));
  }

  async verifyWebhookSignature(
    provider: IPaymentProvider,
    payload: unknown,
    signature: string,
  ): Promise<boolean> {
    return this.fire(() => provider.verifyWebhookSignature(payload, signature));
  }

  // ---------------------------------------------------------------------------
  // Observability helpers (used by health endpoint)
  // ---------------------------------------------------------------------------

  getCircuitState(): CircuitState {
    if (this.breaker.opened) return 'OPEN';
    if (this.breaker.halfOpen) return 'HALF_OPEN';
    return 'CLOSED';
  }

  getStats(): PaymentCircuitStats {
    const raw = this.breaker.status.stats;
    const total = raw.successes + raw.failures + raw.rejects;
    const errorRate = total > 0 ? Math.round((raw.failures / total) * 100) : 0;

    return {
      state: this.getCircuitState(),
      failures: raw.failures,
      successes: raw.successes,
      fallbacks: raw.fallbacks,
      rejects: raw.rejects,
      timeouts: raw.timeouts,
      errorRate,
    };
  }

  /** Expose the raw breaker for testing */
  get circuitBreaker(): CircuitBreaker {
    return this.breaker;
  }
}
