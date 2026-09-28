import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EtlService } from './etl.service';
import { DataWarehouseService } from './data-warehouse.service';
import { BiIntegrationService } from './bi-integration.service';
import { DashboardGateway } from './dashboard.gateway';
import { DataPipelineController } from './data-pipeline.controller';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [DataPipelineController],
  providers: [EtlService, DataWarehouseService, BiIntegrationService, DashboardGateway],
  exports: [EtlService, DataWarehouseService, BiIntegrationService],
})
export class DataPipelineModule {}
