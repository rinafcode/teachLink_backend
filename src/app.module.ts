import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [SearchModule, AnalyticsModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
