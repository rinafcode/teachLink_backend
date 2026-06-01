import { Module } from '@nestjs/common';
import { BackpressureController } from './backpressure.controller';
import { BackpressureService } from './backpressure.service';

@Module({
  controllers: [BackpressureController],
  providers: [BackpressureService],
  exports: [BackpressureService],
})
export class BackpressureModule {}