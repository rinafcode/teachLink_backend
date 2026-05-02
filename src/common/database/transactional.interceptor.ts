import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { TransactionService } from './transaction.service';
import { TRANSACTIONAL_KEY, ITransactionalOptions } from './transactional.decorator';

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

  /**
   * Executes intercept.
   * @param context The context.
   * @param next The next.
   * @returns The resulting observable<any>.
   */
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const options = this.reflector.get<ITransactionalOptions>(
      TRANSACTIONAL_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }
}
