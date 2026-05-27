import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { IndexOptimizationModule } from './database/index-optimization/index-optimization.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SearchModule,
    IndexOptimizationModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
