import { Injectable, Logger } from '@nestjs/common';
import { RETRY_STRATEGIES } from '../queues.constants';
import { IRetryStrategy } from '../interfaces/queue.interfaces';

export type RetryStrategyKey = keyof typeof RETRY_STRATEGIES;

@Injectable()
export class RetryStrategyService {
  private readonly logger = new Logger(RetryStrategyService.name);

  getStrategy(key: RetryStrategyKey): IRetryStrategy {
    return RETRY_STRATEGIES[key];
  }

  getBullBackoff(key: RetryStrategyKey): { type: 'fixed' | 'exponential'; delay: number } {
    const strategy = this.getStrategy(key);
    return { type: strategy.backoffType, delay: strategy.initialDelay };
  }

  getBullAttempts(key: RetryStrategyKey): number {
    return this.getStrategy(key).maxAttempts;
  }

  getAllStrategies(): Record<string, IRetryStrategy> {
    return { ...RETRY_STRATEGIES };
  }
}
