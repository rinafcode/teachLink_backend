import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataRetentionService } from './data-retention.service';
import { DataRetentionTask } from './tasks/data-retention.task';
import { ArchivedData } from './entities/archived-data.entity';
import { retentionConfig } from '../config/retention.config';

@Module({
  imports: [ConfigModule.forFeature(retentionConfig), TypeOrmModule.forFeature([ArchivedData])],
  providers: [DataRetentionService, DataRetentionTask],
  exports: [DataRetentionService],
})
export class DataRetentionModule {}
