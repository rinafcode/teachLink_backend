import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TIME } from '../common/constants/time.constants';
import { IncidentManagementController } from './incident-management.controller';
import { IncidentManagementService } from './incident-management.service';
import { Incident, RemediationAction, RunbookExecution } from './entities';
import {
  IncidentDetectionService,
  AutoRemediationService,
  RunbookExecutionService,
  NotificationAndEscalationService,
} from './services';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: TIME.ONE_MINUTE_MS,
        limit: 100,
      },
    ]),
    TypeOrmModule.forFeature([Incident, RemediationAction, RunbookExecution]),
    ConfigModule,
    CommonModule,
  ],
  controllers: [IncidentManagementController],
  providers: [
    IncidentManagementService,
    IncidentDetectionService,
    AutoRemediationService,
    RunbookExecutionService,
    NotificationAndEscalationService,
  ],
  exports: [
    IncidentManagementService,
    IncidentDetectionService,
    AutoRemediationService,
    RunbookExecutionService,
    NotificationAndEscalationService,
  ],
})
export class IncidentManagementModule {}
