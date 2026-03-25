import { SetMetadata } from '@nestjs/common';
import { TransactionService } from './transaction.service';

export const TRANSACTIONAL_KEY = 'transactional';

export interface TransactionalOptions {
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  retry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Transactional decorator
 * Wraps methods in database transactions with retry logic and error handling
 */
export const Transactional = (options: TransactionalOptions = {}) =>
  function (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const transactionService: TransactionService = this.transactionService;

      if (!transactionService) {
        throw new Error(
          `TransactionService not injected in ${target.constructor.name}. ` +
            `Please inject it via constructor.`,
        );
      }

      const operationName = `${target.constructor.name}.${propertyKey}`;

      try {
        return await transactionService.runWithRetry(
          async (_manager) => {
            return await originalMethod.apply(this, args);
          },
          options.maxRetries ?? 3,
          options.retryDelay ?? 1000,
        );
      } catch (error) {
        console.error(`Transaction failed in ${operationName}:`, error);
        throw error;
      }
    };

    // Attach metadata (useful for interceptors or future enhancements)
    SetMetadata(TRANSACTIONAL_KEY, {
      method: propertyKey,
      options,
    });

    return descriptor;
  };
