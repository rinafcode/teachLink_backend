import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { ConfigService } from '@nestjs/config';

export interface ICircuitBreakerOptions {
  timeout?: number; // Timeout in ms before considering call failed
  errorThresholdPercentage?: number; // Error percentage to open circuit
  resetTimeout?: number; // Time to wait before attempting to close circuit
  rollingCountTimeout?: number; // Window for tracking stats
  rollingCountBuckets?: number; // Number of stat buckets
  name?: string; // Circuit breaker name
  fallback?: (error: Error) => any; // Fallback function
}

export interface ICircuitBreakerStats {
  name: string;
  enabled: boolean;
  closed: boolean;
  stats: {
    failures: number;
    successes: number;
    fallbacks: number;
    rejects: number;
    errors: number;
    timeouts: number;
    latencyTimes: number[];
  };
}

@Injectable()
export class EnhancedCircuitBreakerService implements OnModuleInit {
  private readonly logger = new Logger(EnhancedCircuitBreakerService.name);
  private breakers: Map<string, CircuitBreaker> = new Map();
  private defaultOptions: ICircuitBreakerOptions;

  constructor(private configService: ConfigService) {
    this.defaultOptions = {
      timeout: this.configService.get<number>('CIRCUIT_BREAKER_TIMEOUT_MS', 3000),
      errorThresholdPercentage: this.configService.get<number>(
        'CIRCUIT_BREAKER_ERROR_THRESHOLD',
        50,
      ),
      resetTimeout: this.configService.get<number>('CIRCUIT_BREAKER_RESET_TIMEOUT_MS', 30000),
      rollingCountTimeout: this.configService.get<number>(
        'CIRCUIT_BREAKER_ROLLING_COUNT_TIMEOUT',
        60000,
      ),
      rollingCountBuckets: this.configService.get<number>(
        'CIRCUIT_BREAKER_ROLLING_COUNT_BUCKETS',
        10,
      ),
    };
  }

  onModuleInit() {
    this.logger.log('Enhanced Circuit Breaker Service initialized with opossum');
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    key: string,
    operation: () => Promise<T>,
    options: ICircuitBreakerOptions = {},
  ): Promise<T> {
    let breaker = this.breakers.get(key);

    // Create circuit breaker if it doesn't exist
    if (!breaker) {
      const breakerOptions = {
        ...this.defaultOptions,
        ...options,
        name: options.name || key,
      };

      breaker = new CircuitBreaker(operation, breakerOptions);

      // Set up event listeners
      breaker.on('open', () => {
        this.logger.warn(`Circuit breaker ${key} OPENED - service unavailable`);
      });

      breaker.on('close', () => {
        this.logger.log(`Circuit breaker ${key} CLOSED - service recovered`);
      });

      breaker.on('halfOpen', () => {
        this.logger.log(`Circuit breaker ${key} HALF_OPEN - testing recovery`);
      });

      breaker.on('fallback', (result) => {
        this.logger.warn(`Circuit breaker ${key} FALLBACK triggered`);
      });

      breaker.on('reject', (error) => {
        this.logger.error(`Circuit breaker ${key} REJECTED request`, error);
      });

      breaker.on('timeout', () => {
        this.logger.warn(`Circuit breaker ${key} TIMEOUT`);
      });

      breaker.on('success', () => {
        this.logger.debug(`Circuit breaker ${key} SUCCESS`);
      });

      breaker.on('failure', (error) => {
        this.logger.error(`Circuit breaker ${key} FAILURE`, error);
      });

      this.breakers.set(key, breaker);
    }

    // If fallback is provided in options but breaker already exists, use it
    const fallbackFn =
      options.fallback ||
      (() => {
        throw new Error(`Circuit breaker ${key} is open and no fallback provided`);
      });

    try {
      return await breaker.fire();
    } catch (error) {
      // Try fallback
      try {
        return await fallbackFn(error as Error);
      } catch (fallbackError) {
        this.logger.error(`Circuit breaker ${key} fallback failed`, fallbackError);
        throw error; // Throw original error
      }
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(key: string): ICircuitBreakerStats | null {
    const breaker = this.breakers.get(key);
    if (!breaker) return null;

    return {
      name: breaker.name,
      enabled: breaker.enabled,
      closed: breaker.closed,
      stats: breaker.status.stats,
    };
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, ICircuitBreakerStats> {
    const stats: Record<string, ICircuitBreakerStats> = {};

    for (const [key, breaker] of this.breakers.entries()) {
      stats[key] = {
        name: breaker.name,
        enabled: breaker.enabled,
        closed: breaker.closed,
        stats: breaker.status.stats,
      };
    }

    return stats;
  }

  /**
   * Manually open a circuit breaker
   */
  open(key: string): void {
    const breaker = this.breakers.get(key);
    if (breaker) {
      breaker.shutdown();
      this.logger.warn(`Circuit breaker ${key} manually opened`);
    }
  }

  /**
   * Manually close a circuit breaker
   */
  close(key: string): void {
    const breaker = this.breakers.get(key);
    if (breaker) {
      // Create new breaker to reset state
      this.breakers.delete(key);
      this.logger.log(`Circuit breaker ${key} manually closed and reset`);
    }
  }

  /**
   * Enable circuit breaker
   */
  enable(key: string): void {
    const breaker = this.breakers.get(key);
    if (breaker) {
      breaker.enable();
      this.logger.log(`Circuit breaker ${key} enabled`);
    }
  }

  /**
   * Disable circuit breaker
   */
  disable(key: string): void {
    const breaker = this.breakers.get(key);
    if (breaker) {
      breaker.disable();
      this.logger.log(`Circuit breaker ${key} disabled`);
    }
  }

  /**
   * Shutdown all circuit breakers
   */
  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.breakers.values()).map((breaker) =>
      breaker.shutdown(),
    );
    await Promise.all(shutdownPromises);
    this.breakers.clear();
    this.logger.log('All circuit breakers shut down');
  }

  /**
   * Get health status of all circuit breakers
   */
  getHealthStatus(): {
    total: number;
    healthy: number;
    unhealthy: number;
    circuitBreakers: Record<string, { state: string; errorRate: number }>;
  } {
    const circuitBreakers: Record<string, { state: string; errorRate: number }> = {};
    let healthy = 0;
    let unhealthy = 0;

    for (const [key, breaker] of this.breakers.entries()) {
      const stats = breaker.status.stats;
      const totalRequests = stats.successes + stats.failures + stats.rejects;
      const errorRate = totalRequests > 0 ? (stats.failures / totalRequests) * 100 : 0;

      const state = breaker.closed ? 'CLOSED' : 'OPEN';
      circuitBreakers[key] = { state, errorRate };

      if (breaker.closed && errorRate < 50) {
        healthy++;
      } else {
        unhealthy++;
      }
    }

    return {
      total: this.breakers.size,
      healthy,
      unhealthy,
      circuitBreakers,
    };
  }
}
