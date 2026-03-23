import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { SESSION_REDIS_CLIENT } from './session.constants';
import { SessionService } from './session.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SESSION_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const client = new Redis({
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: parseInt(configService.get<string>('REDIS_PORT') || '6379', 10),
          lazyConnect: false,
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        });

        client.on('error', () => {
          // Prevent unhandled error events when Redis is temporarily unavailable.
        });

        return client;
      },
    },
    SessionService,
  ],
  exports: [SESSION_REDIS_CLIENT, SessionService],
})
export class SessionModule {}
