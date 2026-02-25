import { Injectable, Logger } from '@nestjs/common';
import { TracingService } from '../tracing/tracing.service';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures to open circuit
  recoveryTimeout: number; // Time in ms to wait before attempting recovery
  monitoringPeriod: number; // Time in ms to monitor failures
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuits: Map<string, {
    state: CircuitState;
    failures: number;
    lastFailureTime: number;
    config: CircuitBreakerConfig;
  }> = new Map();

  constructor(private readonly tracingService: TracingService) {}

  async execute<T>(
    key: string,
    operation: () => Promise<T>,
    config: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 10000,
    },
  ): Promise<T> {
    const span = this.tracingService.startSpan(`circuit-breaker-${key}`);
    try {
      const circuit = this.getOrCreateCircuit(key, config);

      if (circuit.state === 'OPEN') {
        if (Date.now() - circuit.lastFailureTime > config.recoveryTimeout) {
          circuit.state = 'HALF_OPEN';
          this.logger.log(`Circuit ${key} moved to HALF_OPEN`);
        } else {
          throw new Error(`Circuit ${key} is OPEN`);
        }
      }

      const result = await operation();
      this.onSuccess(key);
      return result;
    } catch (error) {
      this.onFailure(key, config);
      throw error;
    } finally {
      this.tracingService.endSpan(span);
    }
  }

  private getOrCreateCircuit(key: string, config: CircuitBreakerConfig) {
    if (!this.circuits.has(key)) {
      this.circuits.set(key, {
        state: 'CLOSED',
        failures: 0,
        lastFailureTime: 0,
        config,
      });
    }
    return this.circuits.get(key)!;
  }

  private onSuccess(key: string): void {
    const circuit = this.circuits.get(key);
    if (circuit) {
      circuit.failures = 0;
      if (circuit.state === 'HALF_OPEN') {
        circuit.state = 'CLOSED';
        this.logger.log(`Circuit ${key} closed after successful operation`);
      }
    }
  }

  private onFailure(key: string, config: CircuitBreakerConfig): void {
    const circuit = this.circuits.get(key);
    if (circuit) {
      circuit.failures++;
      circuit.lastFailureTime = Date.now();

      if (circuit.failures >= config.failureThreshold) {
        circuit.state = 'OPEN';
        this.logger.warn(`Circuit ${key} opened due to ${circuit.failures} failures`);
      }
    }
  }

  async getCircuitState(key: string): Promise<CircuitState | null> {
    const circuit = this.circuits.get(key);
    return circuit ? circuit.state : null;
  }

  async getCircuitStats(key: string): Promise<{
    state: CircuitState;
    failures: number;
    lastFailureTime: number;
  } | null> {
    const circuit = this.circuits.get(key);
    if (!circuit) return null;

    return {
      state: circuit.state,
      failures: circuit.failures,
      lastFailureTime: circuit.lastFailureTime,
    };
  }

  async resetCircuit(key: string): Promise<void> {
    const circuit = this.circuits.get(key);
    if (circuit) {
      circuit.state = 'CLOSED';
      circuit.failures = 0;
      circuit.lastFailureTime = 0;
      this.logger.log(`Circuit ${key} manually reset`);
    }
  }

  async getAllCircuits(): Promise<Record<string, {
    state: CircuitState;
    failures: number;
    lastFailureTime: number;
  }>> {
    const result: Record<string, any> = {};
    for (const [key, circuit] of this.circuits) {
      result[key] = {
        state: circuit.state,
        failures: circuit.failures,
        lastFailureTime: circuit.lastFailureTime,
      };
    }
    return result;
  }
}
