import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [SearchModule, MonitoringModule],
  controllers: [AppController],
  providers: featureFlags.ENABLE_RATE_LIMITING
    ? [{ provide: APP_GUARD, useClass: QuotaGuard }]
    : [],
})
export class AppModule {}