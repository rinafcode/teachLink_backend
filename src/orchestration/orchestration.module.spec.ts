import { Test, TestingModule } from '@nestjs/testing';
import { OrchestrationModule } from './orchestration.module';
import { ServiceMeshService } from './service-mesh/service-mesh.service';
import { WorkflowEngineService } from './workflow/workflow-engine.service';
import { DistributedLockService } from './locks/distributed-lock.service';
import { ServiceDiscoveryService } from './discovery/service-discovery.service';
import { HealthCheckerService } from './health/health-checker.service';

describe('OrchestrationModule', () => {
  let mesh: ServiceMeshService;
  let workflow: WorkflowEngineService;
  let lock: DistributedLockService;
  let discovery: ServiceDiscoveryService;
  let health: HealthCheckerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [OrchestrationModule],
    }).compile();
    mesh = module.get(ServiceMeshService);
    workflow = module.get(WorkflowEngineService);
    lock = module.get(DistributedLockService);
    discovery = module.get(ServiceDiscoveryService);
    health = module.get(HealthCheckerService);
  });

  it('should send a message via service mesh', async () => {
    const result = await mesh.sendMessage('test-service', { foo: 'bar' });
    expect(result).toEqual({
      status: 'sent',
      serviceName: 'test-service',
      payload: { foo: 'bar' },
    });
  });

  it('should start a workflow', async () => {
    const result = await workflow.startWorkflow('test-workflow', { input: 1 });
    expect(result).toEqual({
      workflow: 'test-workflow',
      status: 'started',
      input: { input: 1 },
    });
  });

  it('should acquire and release a lock', async () => {
    expect(await lock.acquireLock('resource')).toBe(true);
    expect(await lock.acquireLock('resource')).toBe(false);
    expect(await lock.releaseLock('resource')).toBe(true);
  });

  it('should register and discover a service', async () => {
    await discovery.registerService('svc', 'addr');
    expect(await discovery.discoverService('svc')).toBe('addr');
  });

  it('should check health', async () => {
    const result = await health.checkHealth('svc');
    expect(result).toEqual({ healthy: true });
  });
});
