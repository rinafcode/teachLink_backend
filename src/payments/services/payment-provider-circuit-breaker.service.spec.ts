import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import {
  PaymentProviderCircuitBreakerService,
  CircuitState,
} from './payment-provider-circuit-breaker.service';
import { IPaymentProvider } from '../providers/payment-provider.interface';

/** Creates a minimal mock IPaymentProvider */
function makeMockProvider(
  overrides: Partial<IPaymentProvider> = {},
): jest.Mocked<IPaymentProvider> {
  return {
    name: 'mock-provider',
    createPaymentIntent: jest.fn(),
    createSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    refundPayment: jest.fn(),
    handleWebhook: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    ...overrides,
  } as jest.Mocked<IPaymentProvider>;
}

describe('PaymentProviderCircuitBreakerService', () => {
  let service: PaymentProviderCircuitBreakerService;
  let provider: jest.Mocked<IPaymentProvider>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentProviderCircuitBreakerService],
    }).compile();

    service = module.get<PaymentProviderCircuitBreakerService>(
      PaymentProviderCircuitBreakerService,
    );
    provider = makeMockProvider();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  // ---------------------------------------------------------------------------
  // CLOSED state — happy path
  // ---------------------------------------------------------------------------
  describe('CLOSED state (healthy provider)', () => {
    it('should start in CLOSED state', () => {
      expect(service.getCircuitState()).toBe<CircuitState>('CLOSED');
    });

    it('should forward createPaymentIntent and return provider result', async () => {
      provider.createPaymentIntent.mockResolvedValueOnce({
        clientSecret: 'secret_123',
        paymentIntentId: 'pi_123',
        requiresAction: false,
      });

      const result = await service.createPaymentIntent(provider, 5000, 'usd');

      expect(provider.createPaymentIntent).toHaveBeenCalledWith(5000, 'usd', undefined);
      expect(result.clientSecret).toBe('secret_123');
      expect(result.paymentIntentId).toBe('pi_123');
    });

    it('should forward createSubscription and return provider result', async () => {
      const now = new Date();
      provider.createSubscription.mockResolvedValueOnce({
        subscriptionId: 'sub_123',
        status: 'active',
        currentPeriodEnd: now,
      });

      const result = await service.createSubscription(provider, 'cus_123', 'price_123');

      expect(provider.createSubscription).toHaveBeenCalledWith('cus_123', 'price_123', undefined);
      expect(result.subscriptionId).toBe('sub_123');
    });

    it('should forward cancelSubscription', async () => {
      provider.cancelSubscription.mockResolvedValueOnce(true);
      const result = await service.cancelSubscription(provider, 'sub_456');
      expect(result).toBe(true);
    });

    it('should forward refundPayment', async () => {
      provider.refundPayment.mockResolvedValueOnce({ refundId: 're_123', status: 'succeeded' });
      const result = await service.refundPayment(provider, 'pi_789', 1000);
      expect(result.refundId).toBe('re_123');
    });

    it('should forward handleWebhook', async () => {
      provider.handleWebhook.mockResolvedValueOnce({ type: 'payment.succeeded', data: {} });
      const result = await service.handleWebhook(provider, { raw: 'body' }, 'sig_abc');
      expect(result.type).toBe('payment.succeeded');
    });

    it('should forward verifyWebhookSignature', async () => {
      provider.verifyWebhookSignature.mockResolvedValueOnce(true);
      const result = await service.verifyWebhookSignature(provider, { raw: 'body' }, 'sig_abc');
      expect(result).toBe(true);
    });

    it('should report 0 errorRate when calls succeed', async () => {
      provider.createPaymentIntent.mockResolvedValue({
        clientSecret: 's',
        paymentIntentId: 'p',
      });
      await service.createPaymentIntent(provider, 100, 'usd');
      const stats = service.getStats();
      expect(stats.errorRate).toBe(0);
      expect(stats.successes).toBeGreaterThanOrEqual(1);
    });

    it('should propagate provider errors without opening the circuit below threshold', async () => {
      provider.createPaymentIntent.mockRejectedValueOnce(new Error('card declined'));
      await expect(service.createPaymentIntent(provider, 100, 'usd')).rejects.toThrow(
        'card declined',
      );
      // Below volumeThreshold (5) — circuit stays closed
      expect(service.getCircuitState()).toBe('CLOSED');
    });
  });

  // ---------------------------------------------------------------------------
  // OPEN state — after sufficient failures
  // ---------------------------------------------------------------------------
  describe('OPEN state (provider failing)', () => {
    /**
     * Drive enough failures to trip the circuit.
     * volumeThreshold = 5, errorThresholdPercentage = 50, so we need at least
     * 5 failures (100 % error rate) in the rolling window.
     */
    async function tripCircuit() {
      provider.createPaymentIntent.mockRejectedValue(new Error('provider down'));
      for (let i = 0; i < 5; i++) {
        try {
          await service.createPaymentIntent(provider, 100, 'usd');
        } catch {
          // expected
        }
      }
      // Wait a tick for opossum to update its internal state
      await new Promise((r) => setImmediate(r));
    }

    it('should open the circuit after 5 consecutive failures', async () => {
      await tripCircuit();
      expect(service.getCircuitState()).toBe<CircuitState>('OPEN');
    });

    it('should throw ServiceUnavailableException when circuit is OPEN', async () => {
      await tripCircuit();
      // Circuit is now open — all subsequent calls should fast-fail
      await expect(service.createPaymentIntent(provider, 100, 'usd')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should report state = "down" in getStats() when circuit is OPEN', async () => {
      await tripCircuit();
      const stats = service.getStats();
      expect(stats.state).toBe<CircuitState>('OPEN');
    });

    it('should reject calls without calling the provider when circuit is OPEN', async () => {
      await tripCircuit();
      provider.createPaymentIntent.mockClear();

      try {
        await service.createPaymentIntent(provider, 100, 'usd');
      } catch {
        // expected
      }

      // Provider should NOT have been called (fast-fail)
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // HALF_OPEN state — recovery probe
  //
  // opossum transitions OPEN → HALF_OPEN automatically after `resetTimeout`.
  // For tests we create a local breaker with resetTimeout=50ms and use
  // real timers (jest.useFakeTimers is avoided to keep the test readable).
  // ---------------------------------------------------------------------------
  describe('HALF_OPEN state (probe after resetTimeout)', () => {
    it('should expose a circuitBreaker property for observing state in tests', () => {
      expect(service.circuitBreaker).toBeDefined();
    });

    it('should emit "halfOpen" event after resetTimeout elapses', async () => {
      // Use a fresh local breaker with a short resetTimeout so the test is fast.
      const localBreaker: InstanceType<typeof CircuitBreaker> = new CircuitBreaker(
        (fn: () => Promise<unknown>) => fn(),
        { timeout: 1000, errorThresholdPercentage: 50, resetTimeout: 50, volumeThreshold: 5 },
      );

      let halfOpenEmitted = false;
      localBreaker.on('halfOpen', () => {
        halfOpenEmitted = true;
      });

      // Trip the circuit with 5 failures.
      for (let i = 0; i < 5; i++) {
        try {
          await localBreaker.fire(() => Promise.reject(new Error('fail')));
        } catch {
          /* expected */
        }
      }
      expect(localBreaker.opened).toBe(true);

      // Wait for resetTimeout to fire the half-open transition.
      await new Promise((r) => setTimeout(r, 100));

      expect(halfOpenEmitted).toBe(true);
      expect(localBreaker.halfOpen).toBe(true);

      await localBreaker.shutdown();
    }, 10_000);

    it('should return to CLOSED after a successful probe in half-open state', async () => {
      const localBreaker: InstanceType<typeof CircuitBreaker> = new CircuitBreaker(
        (fn: () => Promise<unknown>) => fn(),
        { timeout: 1000, errorThresholdPercentage: 50, resetTimeout: 50, volumeThreshold: 5 },
      );

      // Trip the circuit.
      for (let i = 0; i < 5; i++) {
        try {
          await localBreaker.fire(() => Promise.reject(new Error('fail')));
        } catch {
          /* expected */
        }
      }
      expect(localBreaker.opened).toBe(true);

      // Wait for half-open transition.
      await new Promise((r) => setTimeout(r, 100));
      expect(localBreaker.halfOpen).toBe(true);

      // Successful probe — circuit should close.
      await localBreaker.fire(() => Promise.resolve('ok'));
      await new Promise((r) => setImmediate(r));

      expect(localBreaker.closed).toBe(true);

      await localBreaker.shutdown();
    }, 10_000);

    it('should stay OPEN after a failed probe in half-open state', async () => {
      const localBreaker: InstanceType<typeof CircuitBreaker> = new CircuitBreaker(
        (fn: () => Promise<unknown>) => fn(),
        { timeout: 1000, errorThresholdPercentage: 50, resetTimeout: 50, volumeThreshold: 5 },
      );

      // Trip the circuit.
      for (let i = 0; i < 5; i++) {
        try {
          await localBreaker.fire(() => Promise.reject(new Error('fail')));
        } catch {
          /* expected */
        }
      }
      expect(localBreaker.opened).toBe(true);

      // Wait for half-open transition.
      await new Promise((r) => setTimeout(r, 100));
      expect(localBreaker.halfOpen).toBe(true);

      // Failed probe — circuit should reopen.
      try {
        await localBreaker.fire(() => Promise.reject(new Error('still down')));
      } catch {
        /* expected */
      }
      await new Promise((r) => setImmediate(r));

      expect(localBreaker.opened).toBe(true);

      await localBreaker.shutdown();
    }, 10_000);
  });

  // ---------------------------------------------------------------------------
  // getStats()
  // ---------------------------------------------------------------------------
  describe('getStats()', () => {
    it('should return correct stats structure', () => {
      const stats = service.getStats();
      expect(stats).toMatchObject({
        state: expect.stringMatching(/^(CLOSED|OPEN|HALF_OPEN)$/),
        failures: expect.any(Number),
        successes: expect.any(Number),
        fallbacks: expect.any(Number),
        rejects: expect.any(Number),
        timeouts: expect.any(Number),
        errorRate: expect.any(Number),
      });
    });

    it('should increment failures on error', async () => {
      provider.createPaymentIntent.mockRejectedValueOnce(new Error('fail'));
      try {
        await service.createPaymentIntent(provider, 100, 'usd');
      } catch {
        // expected
      }
      const stats = service.getStats();
      expect(stats.failures).toBeGreaterThanOrEqual(1);
    });

    it('should increment successes on success', async () => {
      provider.cancelSubscription.mockResolvedValueOnce(true);
      await service.cancelSubscription(provider, 'sub_ok');
      const stats = service.getStats();
      expect(stats.successes).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  describe('onModuleDestroy()', () => {
    it('should shut down the underlying circuit breaker without throwing', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
