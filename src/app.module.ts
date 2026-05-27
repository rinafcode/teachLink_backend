import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { RoutingModule } from './routing/routing.module';
import { CachingModule } from './caching/caching.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    SearchModule,
    RoutingModule,
    CachingModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
