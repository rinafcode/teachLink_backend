import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RunbookExecutionService } from '../services/runbook-execution.service';
import { RunbookExecution, RunbookExecutionStatus } from '../entities/runbook-execution.entity';
import { Incident, IncidentSeverity, IncidentStatus } from '../entities/incident.entity';

describe('RunbookExecutionService', () => {
  let service: RunbookExecutionService;
  let repository: Repository<RunbookExecution>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunbookExecutionService,
        {
          provide: getRepositoryToken(RunbookExecution),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RunbookExecutionService>(RunbookExecutionService);
    repository = module.get<Repository<RunbookExecution>>(getRepositoryToken(RunbookExecution));
  });

  describe('executeRunbook', () => {
    it('should execute a runbook successfully', async () => {
      const incident: Incident = {
        id: 'incident-1',
        title: 'Database Failure',
        description: 'Database is down',
        severity: IncidentSeverity.CRITICAL,
        status: IncidentStatus.DETECTED,
        triggerMetrics: {},
        detectedAt: new Date(),
        updatedAt: new Date(),
        runbookId: 'database-failure',
        remediationActionIds: [],
        escalatedTo: null,
        resolvedAt: null,
        resolutionNotes: null,
      };

      const mockExecution: RunbookExecution = {
        id: 'execution-1',
        incidentId: 'incident-1',
        incident: incident,
        runbookName: 'database-failure',
        runbookPath: '/path/to/database-failure.md',
        status: RunbookExecutionStatus.COMPLETED,
        startedAt: new Date(),
        completedAt: new Date(),
        stepExecutions: [
          {
            stepNumber: 1,
            stepName: 'Check Database Connectivity',
            status: 'completed',
            output: 'Database connection verified',
          },
          {
            stepNumber: 2,
            stepName: 'Check Query Performance',
            status: 'completed',
            output: 'Query performance acceptable',
          },
          {
            stepNumber: 3,
            stepName: 'Run Database Maintenance',
            status: 'completed',
            output: 'Maintenance completed',
          },
        ],
        executionSummary: 'Executed 3 steps: All successful',
        errorDetails: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(repository, 'create').mockReturnValue(mockExecution);
      jest.spyOn(repository, 'save').mockResolvedValue(mockExecution);

      const result = await service.executeRunbook(incident, 'database-failure');

      expect(result.status).toBe(RunbookExecutionStatus.COMPLETED);
      expect(result.stepExecutions.length).toBeGreaterThan(0);
    });

    it('should handle runbook not found gracefully', async () => {
      const incident: Incident = {
        id: 'incident-1',
        title: 'Unknown Incident',
        description: 'Unknown incident type',
        severity: IncidentSeverity.WARNING,
        status: IncidentStatus.DETECTED,
        triggerMetrics: {},
        detectedAt: new Date(),
        updatedAt: new Date(),
        runbookId: 'unknown-runbook',
        remediationActionIds: [],
        escalatedTo: null,
        resolvedAt: null,
        resolutionNotes: null,
      };

      const mockExecution: RunbookExecution = {
        id: 'execution-2',
        incidentId: 'incident-1',
        incident: incident,
        runbookName: 'unknown-runbook',
        runbookPath: '/path/to/unknown-runbook.md',
        status: RunbookExecutionStatus.FAILED,
        startedAt: new Date(),
        completedAt: new Date(),
        stepExecutions: [],
        executionSummary: null,
        errorDetails: 'Runbook not found: unknown-runbook',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(repository, 'create').mockReturnValue(mockExecution);
      jest.spyOn(repository, 'save').mockResolvedValue(mockExecution);

      const result = await service.executeRunbook(incident, 'unknown-runbook');

      expect(result.status).toBe(RunbookExecutionStatus.FAILED);
      expect(result.errorDetails).toBeDefined();
    });
  });

  describe('listAvailableRunbooks', () => {
    it('should list available runbooks', async () => {
      const runbooks = await service.listAvailableRunbooks();

      expect(Array.isArray(runbooks)).toBe(true);
      expect(runbooks.length).toBeGreaterThan(0);
      expect(runbooks).toContain('database-failure');
    });
  });

  describe('getRunbookExecutionsForIncident', () => {
    it('should retrieve runbook executions for incident', async () => {
      const mockExecutions: RunbookExecution[] = [
        {
          id: 'execution-1',
          incidentId: 'incident-1',
          incident: null,
          runbookName: 'database-failure',
          runbookPath: '/path/to/database-failure.md',
          status: RunbookExecutionStatus.COMPLETED,
          startedAt: new Date(),
          completedAt: new Date(),
          stepExecutions: [],
          executionSummary: 'Success',
          errorDetails: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(repository, 'find').mockResolvedValue(mockExecutions);

      const result = await service.getRunbookExecutionsForIncident('incident-1');

      expect(result).toEqual(mockExecutions);
      expect(repository.find).toHaveBeenCalledWith({
        where: { incidentId: 'incident-1' },
        order: { startedAt: 'DESC' },
      });
    });
  });
});
