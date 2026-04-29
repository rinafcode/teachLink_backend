import { Module, Global } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionalInterceptor } from './transactional.interceptor';
import { DatabasePoolModule } from '../../database/database-pool.module';
import { ShardingModule } from './sharding/sharding.module';

/**
 * Database Module
 * Provides transaction management services globally
 */
@Global()
@Module({
  imports: [DatabasePoolModule, ShardingModule],
  providers: [TransactionService, TransactionalInterceptor],
  exports: [TransactionService, TransactionalInterceptor, DatabasePoolModule, ShardingModule],
})
export class DatabaseModule {}
