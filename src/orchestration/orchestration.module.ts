import { Global, Module } from '@nestjs/common';
import { DistributedLockService } from './locks/distributed-lock.service';
import { RedisModule } from '../common/redis/redis.module';

@Global()
@Module({
  imports: [RedisModule.forRoot()],
  providers: [DistributedLockService],
  exports: [DistributedLockService],
})
export class OrchestrationModule {}
