import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DistributedLockService, DISTRIBUTED_LOCK_REDIS } from './locks/distributed-lock.service';
import { getSharedRedisClient } from '../config/cache.config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DISTRIBUTED_LOCK_REDIS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => getSharedRedisClient(configService),
    },
    DistributedLockService,
  ],
  exports: [DistributedLockService],
})
export class OrchestrationModule {}
