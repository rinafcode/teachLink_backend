import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getSharedRedisClient } from '../../config/cache.config';
import { IDEMPOTENCY_REDIS_CLIENT } from '../constants/idempotency.constants';
import { IdempotencyService } from '../services/idempotency.service';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: IDEMPOTENCY_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ReturnType<typeof getSharedRedisClient> =>
        getSharedRedisClient(configService),
    },
    IdempotencyService,
    IdempotencyInterceptor,
  ],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
