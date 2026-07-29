import { Injectable } from '@nestjs/common';
import { PaymentProviderCircuitBreakerService } from '../payments/services/payment-provider-circuit-breaker.service';

export interface PaymentProviderHealthResult {
  status: 'up' | 'degraded' | 'down';
  circuitState: string;
  errorRate: number;
  failures: number;
  successes: number;
  rejects: number;
}

@Injectable()
export class HealthIndicatorsService {
  constructor(private readonly paymentCircuitBreaker: PaymentProviderCircuitBreakerService) {}

  async checkPostgres(): Promise<boolean> {
    return true;
  }

  async checkRedis(): Promise<boolean> {
    return true;
  }

  async checkElasticsearch(): Promise<boolean> {
    return true;
  }

  async checkQueueDepth(): Promise<boolean> {
    return true;
  }

  checkPaymentProvider(): PaymentProviderHealthResult {
    const stats = this.paymentCircuitBreaker.getStats();

    let status: 'up' | 'degraded' | 'down';
    switch (stats.state) {
      case 'OPEN':
        status = 'down';
        break;
      case 'HALF_OPEN':
        status = 'degraded';
        break;
      default:
        status = 'up';
    }

    return {
      status,
      circuitState: stats.state,
      errorRate: stats.errorRate,
      failures: stats.failures,
      successes: stats.successes,
      rejects: stats.rejects,
    };
  }

  async readiness(): Promise<Record<string, string>> {
    const paymentHealth = this.checkPaymentProvider();
    const results = {
      postgres: (await this.checkPostgres()) ? 'up' : 'down',
      redis: (await this.checkRedis()) ? 'up' : 'down',
      elasticsearch: (await this.checkElasticsearch()) ? 'up' : 'down',
      queue: (await this.checkQueueDepth()) ? 'up' : 'down',
      paymentProvider: paymentHealth.status,
    };
    return results;
  }
}
