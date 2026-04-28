import { Module, Global } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionalInterceptor } from './transactional.interceptor';
import { DatabasePoolModule } from '../../database/database-pool.module';

/**
 * Database Module
 * Provides transaction management services globally
 */
@Global()
@Module({
  imports: [DatabasePoolModule],
  providers: [TransactionService, TransactionalInterceptor],
  exports: [TransactionService, TransactionalInterceptor, DatabasePoolModule],
})
export class DatabaseModule {}
