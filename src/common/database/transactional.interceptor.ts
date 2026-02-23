import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { TransactionService } from './transaction.service';
import { TRANSACTIONAL_KEY, TransactionalOptions } from './transactional.decorator';

/**
 * Interceptor to automatically wrap methods in transactions
 */
@Injectable()
export class TransactionalInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TransactionalInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly transactionService: TransactionService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const options = this.reflector.get<TransactionalOptions>(
      TRANSACTIONAL_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const handler = context.getHandler();
    const className = context.getClass().name;
    const methodName = handler.name;

    this.logger.debug(
      `Executing transactional method: ${className}.${methodName}`,
    );

    try {
      let result;

      if (options.retry) {
        result = await this.transactionService.runWithRetry(
          async (manager) => {
            // Execute the original method
            return await next.handle().toPromise();
          },
          options.maxRetries || 3,
          options.retryDelay || 1000,
        );
      } else if (options.isolationLevel) {
        result = await this.transactionService.runWithIsolationLevel(
          options.isolationLevel,
          async (manager) => {
            return await next.handle().toPromise();
          },
        );
      } else {
        result = await this.transactionService.runInTransaction(
          async (manager) => {
            return await next.handle().toPromise();
          },
        );
      }

      return new Observable((subscriber) => {
        subscriber.next(result);
        subscriber.complete();
      });
    } catch (error) {
      this.logger.error(
        `Transaction failed in ${className}.${methodName}:`,
        error,
      );
      throw error;
    }
  }
}
