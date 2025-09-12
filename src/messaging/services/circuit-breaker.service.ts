import { Injectable, Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  type CircuitBreakerState,
  CircuitState,
} from '../entities/circuit-breaker-state.entity';
import type { CircuitBreakerConfig } from '../interfaces/messaging.interfaces';

export class CircuitBreakerOpenException extends Error {
  constructor(serviceName: string, operation: string) {
    super(`Circuit breaker is open for ${serviceName}:${operation}`);
    this.name = 'CircuitBreakerOpenException';
  }
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    monitoringPeriod: 60000, // 1 minute
    minimumThroughput: 10,
  };

  private circuitBreakerRepository: Repository<CircuitBreakerState>;

  constructor(circuitBreakerRepository: Repository<CircuitBreakerState>) {
    this.circuitBreakerRepository = circuitBreakerRepository;
  }

  async executeWithCircuitBreaker<T>(
    serviceName: string,
    operation: string,
    fn: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>,
  ): Promise<T> {
    const circuitConfig = { ...this.defaultConfig, ...config };
    const circuitBreaker = await this.getOrCreateCircuitBreaker(
      serviceName,
      operation,
      circuitConfig,
    );

    // Check circuit state
    if (circuitBreaker.state === CircuitState.OPEN) {
      if (Date.now() < circuitBreaker.nextAttemptTime.getTime()) {
        throw new CircuitBreakerOpenException(serviceName, operation);
      } else {
        // Transition to half-open
        await this.updateCircuitState(
          circuitBreaker.id,
          CircuitState.HALF_OPEN,
        );
        circuitBreaker.state = CircuitState.HALF_OPEN;
      }
    }

    const startTime = Date.now();

    try {
      const result = await fn();
      const responseTime = Date.now() - startTime;

      // Record success
      await this.recordSuccess(circuitBreaker.id, responseTime);

      // If half-open and successful, close the circuit
      if (circuitBreaker.state === CircuitState.HALF_OPEN) {
        await this.updateCircuitState(circuitBreaker.id, CircuitState.CLOSED);
        this.logger.log(
          `Circuit breaker closed for ${serviceName}:${operation}`,
        );
      }

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Record failure
      await this.recordFailure(circuitBreaker.id, responseTime);

      // Check if we should open the circuit
      const updatedCircuit = await this.circuitBreakerRepository.findOne({
        where: { id: circuitBreaker.id },
      });

      if (
        updatedCircuit &&
        this.shouldOpenCircuit(updatedCircuit, circuitConfig)
      ) {
        await this.openCircuit(
          updatedCircuit.id,
          circuitConfig.recoveryTimeout,
        );
        this.logger.warn(
          `Circuit breaker opened for ${serviceName}:${operation}`,
        );
      }

      throw error;
    }
  }

  async getCircuitBreakerState(
    serviceName: string,
    operation: string,
  ): Promise<CircuitBreakerState | null> {
    return this.circuitBreakerRepository.findOne({
      where: { serviceName, operation },
    });
  }

  async resetCircuitBreaker(
    serviceName: string,
    operation: string,
  ): Promise<void> {
    await this.circuitBreakerRepository.update(
      { serviceName, operation },
      {
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        requestCount: 0,
        failureRate: 0,
        lastFailureTime: null,
        nextAttemptTime: null,
      },
    );

    this.logger.log(`Circuit breaker reset for ${serviceName}:${operation}`);
  }

  async forceOpenCircuit(
    serviceName: string,
    operation: string,
    recoveryTimeout?: number,
  ): Promise<void> {
    const timeout = recoveryTimeout || this.defaultConfig.recoveryTimeout;
    const nextAttemptTime = new Date(Date.now() + timeout);

    await this.circuitBreakerRepository.update(
      { serviceName, operation },
      {
        state: CircuitState.OPEN,
        nextAttemptTime,
      },
    );

    this.logger.log(
      `Circuit breaker force opened for ${serviceName}:${operation}`,
    );
  }

  async forceCloseCircuit(
    serviceName: string,
    operation: string,
  ): Promise<void> {
    await this.circuitBreakerRepository.update(
      { serviceName, operation },
      {
        state: CircuitState.CLOSED,
        failureCount: 0,
        nextAttemptTime: null,
      },
    );

    this.logger.log(
      `Circuit breaker force closed for ${serviceName}:${operation}`,
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async monitorCircuitBreakers(): Promise<void> {
    const circuitBreakers = await this.circuitBreakerRepository.find();

    for (const circuit of circuitBreakers) {
      // Reset counters periodically for monitoring period
      const monitoringPeriodAgo = new Date(
        Date.now() - circuit.configuration.monitoringPeriod,
      );

      if (circuit.updatedAt < monitoringPeriodAgo) {
        await this.circuitBreakerRepository.update(circuit.id, {
          failureCount: 0,
          successCount: 0,
          requestCount: 0,
          failureRate: 0,
        });
      }

      // Check if open circuits should transition to half-open
      if (
        circuit.state === CircuitState.OPEN &&
        circuit.nextAttemptTime &&
        Date.now() >= circuit.nextAttemptTime.getTime()
      ) {
        await this.updateCircuitState(circuit.id, CircuitState.HALF_OPEN);
        this.logger.log(
          `Circuit breaker transitioned to half-open: ${circuit.serviceName}:${circuit.operation}`,
        );
      }
    }
  }

  async getCircuitBreakerMetrics(): Promise<{
    totalCircuits: number;
    openCircuits: number;
    halfOpenCircuits: number;
    closedCircuits: number;
    circuitsByService: Record<string, number>;
    averageFailureRate: number;
  }> {
    const circuits = await this.circuitBreakerRepository.find();

    const totalCircuits = circuits.length;
    const openCircuits = circuits.filter(
      (c) => c.state === CircuitState.OPEN,
    ).length;
    const halfOpenCircuits = circuits.filter(
      (c) => c.state === CircuitState.HALF_OPEN,
    ).length;
    const closedCircuits = circuits.filter(
      (c) => c.state === CircuitState.CLOSED,
    ).length;

    const circuitsByService = circuits.reduce(
      (acc, circuit) => {
        acc[circuit.serviceName] = (acc[circuit.serviceName] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const averageFailureRate =
      circuits.length > 0
        ? circuits.reduce((sum, c) => sum + Number(c.failureRate), 0) /
          circuits.length
        : 0;

    return {
      totalCircuits,
      openCircuits,
      halfOpenCircuits,
      closedCircuits,
      circuitsByService,
      averageFailureRate,
    };
  }

  private async getOrCreateCircuitBreaker(
    serviceName: string,
    operation: string,
    config: CircuitBreakerConfig,
  ): Promise<CircuitBreakerState> {
    let circuitBreaker = await this.circuitBreakerRepository.findOne({
      where: { serviceName, operation },
    });

    if (!circuitBreaker) {
      circuitBreaker = this.circuitBreakerRepository.create({
        serviceName,
        operation,
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        requestCount: 0,
        failureRate: 0,
        averageResponseTime: 0,
        configuration: config,
      });

      circuitBreaker = await this.circuitBreakerRepository.save(circuitBreaker);
    }

    return circuitBreaker;
  }

  private async recordSuccess(
    circuitId: string,
    responseTime: number,
  ): Promise<void> {
    await this.circuitBreakerRepository.increment(
      { id: circuitId },
      'successCount',
      1,
    );
    await this.circuitBreakerRepository.increment(
      { id: circuitId },
      'requestCount',
      1,
    );

    // Update average response time
    const circuit = await this.circuitBreakerRepository.findOne({
      where: { id: circuitId },
    });
    if (circuit) {
      const newAverage =
        (circuit.averageResponseTime * (circuit.requestCount - 1) +
          responseTime) /
        circuit.requestCount;
      await this.circuitBreakerRepository.update(circuitId, {
        averageResponseTime: newAverage,
      });
    }
  }

  private async recordFailure(
    circuitId: string,
    responseTime: number,
  ): Promise<void> {
    await this.circuitBreakerRepository.increment(
      { id: circuitId },
      'failureCount',
      1,
    );
    await this.circuitBreakerRepository.increment(
      { id: circuitId },
      'requestCount',
      1,
    );
    await this.circuitBreakerRepository.update(circuitId, {
      lastFailureTime: new Date(),
    });

    // Update failure rate
    const circuit = await this.circuitBreakerRepository.findOne({
      where: { id: circuitId },
    });
    if (circuit) {
      const failureRate = circuit.failureCount / circuit.requestCount;
      const newAverage =
        (circuit.averageResponseTime * (circuit.requestCount - 1) +
          responseTime) /
        circuit.requestCount;

      await this.circuitBreakerRepository.update(circuitId, {
        failureRate,
        averageResponseTime: newAverage,
      });
    }
  }

  private shouldOpenCircuit(
    circuit: CircuitBreakerState,
    config: CircuitBreakerConfig,
  ): boolean {
    return (
      circuit.requestCount >= config.minimumThroughput &&
      circuit.failureCount >= config.failureThreshold &&
      circuit.failureRate >= 0.5 // 50% failure rate
    );
  }

  private async openCircuit(
    circuitId: string,
    recoveryTimeout: number,
  ): Promise<void> {
    const nextAttemptTime = new Date(Date.now() + recoveryTimeout);

    await this.circuitBreakerRepository.update(circuitId, {
      state: CircuitState.OPEN,
      nextAttemptTime,
    });
  }

  private async updateCircuitState(
    circuitId: string,
    state: CircuitState,
  ): Promise<void> {
    await this.circuitBreakerRepository.update(circuitId, { state });
  }
}
