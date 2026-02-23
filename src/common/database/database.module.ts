import { Module, Global } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionalInterceptor } from './transactional.interceptor';

/**
 * Database Module
 * Provides transaction management services globally
 */
@Global()
@Module({
  providers: [TransactionService, TransactionalInterceptor],
  exports: [TransactionService, TransactionalInterceptor],
})
export class DatabaseModule {}
