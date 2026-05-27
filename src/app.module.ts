import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [SearchModule, MonitoringModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
