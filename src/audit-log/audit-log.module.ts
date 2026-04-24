import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditLog } from './audit-log.entity';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditRetentionTask } from './tasks/audit-retention.task';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), ConfigModule, ScheduleModule.forRoot()],
  controllers: [AuditLogController],
  providers: [AuditLogService, AuditLogInterceptor, AuditRetentionTask],
  exports: [AuditLogService, AuditLogInterceptor],
})
export class AuditLogModule {}
