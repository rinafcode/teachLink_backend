import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ServiceMeshService } from './service-mesh/service-mesh.service';
import { WorkflowEngineService } from './workflow/workflow-engine.service';
import { DistributedLockService } from './locks/distributed-lock.service';
import { ServiceDiscoveryService } from './discovery/service-discovery.service';
import { HealthCheckerService } from './health/health-checker.service';
@Global()
@Module({
    imports: [HttpModule],
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
export class OrchestrationModule {
}
