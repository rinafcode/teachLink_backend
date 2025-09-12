import { Controller, Post, Body } from '@nestjs/common';
import { ServiceMeshService } from './service-mesh/service-mesh.service';
import { WorkflowEngineService } from './workflow/workflow-engine.service';
import { DistributedLockService } from './locks/distributed-lock.service';
import { ServiceDiscoveryService } from './discovery/service-discovery.service';
import { HealthCheckerService } from './health/health-checker.service';

@Controller('orchestration')
export class OrchestrationController {
  constructor(
    private readonly mesh: ServiceMeshService,
    private readonly workflow: WorkflowEngineService,
    private readonly lock: DistributedLockService,
    private readonly discovery: ServiceDiscoveryService,
    private readonly health: HealthCheckerService,
  ) {}

  @Post('send-message')
  sendMessage(@Body() body: { serviceName: string; payload: any }) {
    return this.mesh.sendMessage(body.serviceName, body.payload);
  }

  @Post('start-workflow')
  startWorkflow(@Body() body: { name: string; input: any }) {
    return this.workflow.startWorkflow(body.name, body.input);
  }

  @Post('acquire-lock')
  acquireLock(@Body() body: { resource: string }) {
    return this.lock.acquireLock(body.resource);
  }

  @Post('register-service')
  registerService(@Body() body: { name: string; address: string }) {
    return this.discovery.registerService(body.name, body.address);
  }

  @Post('check-health')
  checkHealth(@Body() body: { serviceName: string }) {
    return this.health.checkHealth(body.serviceName);
  }
}
