import { Module } from '@nestjs/common';
import { ServiceMeshService } from './service-mesh/service-mesh.service';
import { WorkflowEngineService } from './workflow/workflow-engine.service';
import { DistributedLockService } from './locks/distributed-lock.service';
import { ServiceDiscoveryService } from './discovery/service-discovery.service';
import { HealthCheckerService } from './health/health-checker.service';

@Module({
  providers: [
    ServiceMeshService,
    WorkflowEngineService,
    DistributedLockService,
    ServiceDiscoveryService,
    HealthCheckerService,
  ],
  exports: [
    ServiceMeshService,
    WorkflowEngineService,
    DistributedLockService,
    ServiceDiscoveryService,
    HealthCheckerService,
  ],
})
export class OrchestrationModule {} 