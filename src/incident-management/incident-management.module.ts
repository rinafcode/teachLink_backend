import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { IncidentManagementController } from './incident-management.controller';
import { IncidentManagementService } from './incident-management.service';
import {
  Incident,
  RemediationAction,
  RunbookExecution,
} from './entities';
import {
  IncidentDetectionService,
  AutoRemediationService,
  RunbookExecutionService,
  NotificationAndEscalationService,
} from './services';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Incident,
      RemediationAction,
      RunbookExecution,
    ]),
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
