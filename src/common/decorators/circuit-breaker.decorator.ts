import { SetMetadata } from '@nestjs/common';
import { ICircuitBreakerOptions } from '../services/circuit-breaker.service';

export const CIRCUIT_BREAKER_METADATA = 'circuit-breaker:options';

export interface CircuitBreakerDecoratorOptions {
  key?: string; // Circuit breaker key (defaults to endpoint)
  fallback?: (error: Error) => any; // Fallback function
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
}

export const UseCircuitBreaker = (options: CircuitBreakerDecoratorOptions = {}) => {
  return SetMetadata(CIRCUIT_BREAKER_METADATA, options);
};
