import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SegmentService } from './segment.service';
import { SegmentController } from './segment.controller';
import { SegmentDestinationConfig } from './segment-destination-config.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([SegmentDestinationConfig])],
  providers: [SegmentService],
  controllers: [SegmentController],
  exports: [SegmentService],
})
export class SegmentModule {}
