import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuditLog } from './audit-log.entity';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    ConfigModule,
  ],
  controllers: [AuditLogController],
  providers: [
    AuditLogService,
    AuditLogInterceptor,
  ],
  exports: [
    AuditLogService,
    AuditLogInterceptor,
  ],
})
export class AuditLogModule {}
