import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { AutomationService } from './automation.service';
import { AutomationWorkflow } from '../entities/automation-workflow.entity';
import { AutomationTrigger } from '../entities/automation-trigger.entity';
import { AutomationAction } from '../entities/automation-action.entity';
import { EmailEvent } from '../entities/email-event.entity';
import { EmailEventType } from '../enums/email-event-type.enum';
import { QUEUE_NAMES } from '../../common/constants/queue.constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowStatus } from '../enums/workflow-status.enum';
import { ResourceNotFoundException } from '../../common/exceptions/app.exceptions';

describe('AutomationService', () => {
  let service: AutomationService;
  let workflowRepo: jest.Mocked<Record<string, jest.Mock>>;
  let emailEventRepo: jest.Mocked<Record<string, jest.Mock>>;

  function createMockRepo() {
    return {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      count: jest.fn().mockResolvedValue(0),
      softDelete: jest.fn(),
      manager: { transaction: jest.fn() },
    };
  }

  function createWorkflow(overrides: Partial<AutomationWorkflow> = {}): AutomationWorkflow {
    return {
      id: 'wf-1',
      version: 1,
      name: 'Test Workflow',
      description: null,
      status: WorkflowStatus.ACTIVE,
      triggers: [],
      actions: [],
      executionCount: 5,
      lastExecutedAt: new Date('2026-07-01T12:00:00Z'),
      activatedAt: null,
      deactivatedAt: null,
      createdAt: new Date('2026-06-01T12:00:00Z'),
      updatedAt: new Date('2026-07-01T12:00:00Z'),
      deletedAt: null,
      ...overrides,
    } as AutomationWorkflow;
  }

  beforeEach(async () => {
    workflowRepo = createMockRepo() as any;
    emailEventRepo = createMockRepo() as any;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationService,
        { provide: getRepositoryToken(AutomationWorkflow), useValue: workflowRepo },
        { provide: getRepositoryToken(AutomationTrigger), useValue: createMockRepo() },
        { provide: getRepositoryToken(AutomationAction), useValue: createMockRepo() },
        { provide: getRepositoryToken(EmailEvent), useValue: emailEventRepo },
        { provide: getQueueToken(QUEUE_NAMES.EMAIL_MARKETING), useValue: { add: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn(), on: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(AutomationService);
  });

  describe('getWorkflowStats', () => {
    it('returns null email stats when no events exist for the workflow', async () => {
      workflowRepo.findOne.mockResolvedValue(createWorkflow());
      emailEventRepo.count.mockResolvedValue(0);

      const stats = await service.getWorkflowStats('wf-1');

      expect(stats).toEqual({
        executionCount: 5,
        lastExecutedAt: new Date('2026-07-01T12:00:00Z'),
        emailsSent: null,
        openRate: null,
        clickRate: null,
      });
    });

    it('returns real event counts and computed rates when events are recorded', async () => {
      workflowRepo.findOne.mockResolvedValue(createWorkflow());
      emailEventRepo.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(40)
        .mockResolvedValueOnce(12);

      const stats = await service.getWorkflowStats('wf-1');

      expect(stats).toEqual({
        executionCount: 5,
        lastExecutedAt: new Date('2026-07-01T12:00:00Z'),
        emailsSent: 100,
        openRate: 50,
        clickRate: 15,
      });
      expect(emailEventRepo.count).toHaveBeenCalledTimes(4);
      expect(emailEventRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workflowId: 'wf-1', eventType: EmailEventType.SENT } }),
      );
      expect(emailEventRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workflowId: 'wf-1', eventType: EmailEventType.DELIVERED },
        }),
      );
      expect(emailEventRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workflowId: 'wf-1', eventType: EmailEventType.OPENED },
        }),
      );
      expect(emailEventRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workflowId: 'wf-1', eventType: EmailEventType.CLICKED },
        }),
      );
    });

    it('returns null rates when delivered count is zero', async () => {
      workflowRepo.findOne.mockResolvedValue(createWorkflow());
      emailEventRepo.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const stats = await service.getWorkflowStats('wf-1');

      expect(stats.emailsSent).toBe(10);
      expect(stats.openRate).toBeNull();
      expect(stats.clickRate).toBeNull();
    });

    it('preserves executionCount and lastExecutedAt from the workflow row', async () => {
      const workflow = createWorkflow({
        executionCount: 12,
        lastExecutedAt: new Date('2026-07-15T08:30:00Z'),
      });
      workflowRepo.findOne.mockResolvedValue(workflow);
      emailEventRepo.count.mockResolvedValue(0);

      const stats = await service.getWorkflowStats('wf-1');

      expect(stats.executionCount).toBe(12);
      expect(stats.lastExecutedAt).toEqual(new Date('2026-07-15T08:30:00Z'));
    });

    it('uses executionCount of 0 when workflow.executionCount is null', async () => {
      workflowRepo.findOne.mockResolvedValue(createWorkflow({ executionCount: null as any }));
      emailEventRepo.count.mockResolvedValue(0);

      const stats = await service.getWorkflowStats('wf-1');

      expect(stats.executionCount).toBe(0);
    });

    it('throws ResourceNotFoundException for unknown workflow', async () => {
      workflowRepo.findOne.mockResolvedValue(null);

      await expect(service.getWorkflowStats('nonexistent')).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('queries counts for the correct workflowId', async () => {
      workflowRepo.findOne.mockResolvedValue(createWorkflow());
      emailEventRepo.count.mockResolvedValue(0);

      await service.getWorkflowStats('wf-42');

      for (const call of emailEventRepo.count.mock.calls) {
        expect(call[0].where.workflowId).toBe('wf-42');
      }
    });
  });
});
