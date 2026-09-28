import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthAggregationController } from './health-aggregation.controller';
import { HealthAggregationService } from './health-aggregation.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [HealthAggregationController],
  providers: [HealthAggregationService],
  exports: [HealthAggregationService],
})
export class HealthAggregationModule {}
