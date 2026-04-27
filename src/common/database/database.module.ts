import { Module, Global } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionalInterceptor } from './transactional.interceptor';
import { ShardingModule } from './sharding/sharding.module';

/**
 * Database Module
 * Provides transaction management services globally
 */
@Global()
@Module({
  imports: [ShardingModule],
  providers: [TransactionService, TransactionalInterceptor],
  exports: [TransactionService, TransactionalInterceptor, ShardingModule],
})
export class DatabaseModule {}
