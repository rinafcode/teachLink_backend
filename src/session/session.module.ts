import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getSharedRedisClient } from '../config/cache.config';
import { SESSION_REDIS_CLIENT } from './session.constants';
import { SessionService } from './session.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SESSION_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ReturnType<typeof getSharedRedisClient> =>
        getSharedRedisClient(configService),
    },
    SessionService,
  ],
  exports: [SESSION_REDIS_CLIENT, SessionService],
})
export class SessionModule {}
