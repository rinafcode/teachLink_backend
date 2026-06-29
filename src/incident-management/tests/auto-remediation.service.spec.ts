import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AutoRemediationService } from '../services/auto-remediation.service';
import { RemediationAction, RemediationStatus } from '../entities/remediation-action.entity';
import { Incident, IncidentSeverity, IncidentStatus } from '../entities/incident.entity';

describe('AutoRemediationService', () => {
  let service: AutoRemediationService;
  let repository: Repository<RemediationAction>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoRemediationService,
        {
          provide: getRepositoryToken(RemediationAction),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AutoRemediationService>(AutoRemediationService);
    repository = module.get<Repository<RemediationAction>>(getRepositoryToken(RemediationAction));
  });

  describe('executeRemediationAction', () => {
    it('should execute restart_service action successfully', async () => {
      const incident: Incident = {
        id: 'incident-1',
        title: 'Service Down',
        description: 'API service is down',
        severity: IncidentSeverity.CRITICAL,
        status: IncidentStatus.DETECTED,
        triggerMetrics: {},
        detectedAt: new Date(),
        updatedAt: new Date(),
        runbookId: null,
        remediationActionIds: [],
        escalatedTo: null,
        resolvedAt: null,
        resolutionNotes: null,
      };

      const mockAction: RemediationAction = {
        id: 'action-1',
        incidentId: 'incident-1',
        actionType: 'restart_service',
        description: 'Restart API service',
        status: RemediationStatus.COMPLETED,
        parameters: { serviceName: 'api-server' },
        executionOutput: 'Service api-server restarted successfully',
        autoRollback: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        executedAt: new Date(),
        errorMessage: null,
        rolledBackAt: null,
        incident: null,
      };

      jest.spyOn(repository, 'create').mockReturnValue(mockAction);
      jest.spyOn(repository, 'save').mockResolvedValue(mockAction);

      const result = await service.executeRemediationAction(
        incident,
        'restart_service',
        'Restart API service',
        { serviceName: 'api-server' },
        false,
      );

      expect(result.status).toBe(RemediationStatus.COMPLETED);
      expect(result.executionOutput).toContain('successfully');
    });

    it('should execute clear_cache action successfully', async () => {
      const incident: Incident = {
        id: 'incident-1',
        title: 'Cache Issue',
        description: 'Cache hit rate too low',
        severity: IncidentSeverity.WARNING,
        status: IncidentStatus.DETECTED,
        triggerMetrics: {},
        detectedAt: new Date(),
        updatedAt: new Date(),
        runbookId: null,
        remediationActionIds: [],
        escalatedTo: null,
        resolvedAt: null,
        resolutionNotes: null,
      };

      const mockAction: RemediationAction = {
        id: 'action-2',
        incidentId: 'incident-1',
        actionType: 'clear_cache',
        description: 'Clear application cache',
        status: RemediationStatus.COMPLETED,
        parameters: { cacheType: 'all' },
        executionOutput: 'Cache (all) cleared successfully',
        autoRollback: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        executedAt: new Date(),
        errorMessage: null,
        rolledBackAt: null,
        incident: null,
      };

      jest.spyOn(repository, 'create').mockReturnValue(mockAction);
      jest.spyOn(repository, 'save').mockResolvedValue(mockAction);

      const result = await service.executeRemediationAction(
        incident,
        'clear_cache',
        'Clear application cache',
        { cacheType: 'all' },
      );

      expect(result.status).toBe(RemediationStatus.COMPLETED);
    });

    it('should handle remediation action failure', async () => {
      const incident: Incident = {
        id: 'incident-1',
        title: 'Scale Issue',
        description: 'High resource usage',
        severity: IncidentSeverity.WARNING,
        status: IncidentStatus.DETECTED,
        triggerMetrics: {},
        detectedAt: new Date(),
        updatedAt: new Date(),
        runbookId: null,
        remediationActionIds: [],
        escalatedTo: null,
        resolvedAt: null,
        resolutionNotes: null,
      };

      const mockAction: RemediationAction = {
        id: 'action-3',
        incidentId: 'incident-1',
        actionType: 'scale_resources',
        description: 'Scale up replicas',
        status: RemediationStatus.FAILED,
        parameters: { replicas: 0 }, // Invalid replicas
        executionOutput: 'Resource scaling failed',
        errorMessage: 'Valid replicas count is required',
        autoRollback: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        executedAt: new Date(),
        rolledBackAt: null,
        incident: null,
      };

      jest.spyOn(repository, 'create').mockReturnValue(mockAction);
      jest.spyOn(repository, 'save').mockResolvedValue(mockAction);

      const result = await service.executeRemediationAction(
        incident,
        'scale_resources',
        'Scale up replicas',
        { replicas: 0 },
        true,
      );

      expect(result.status).toBe(RemediationStatus.FAILED);
      expect(result.errorMessage).toBeDefined();
    });
  });

  describe('suggestRemediationActions', () => {
    it('should suggest actions for Database incident', () => {
      const suggestions = service.suggestRemediationActions(
        'Database Performance Degradation Detected',
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].actionType).toMatch(
        /database_operation|restart_service|run_database_query/,
      );
    });

    it('should suggest actions for Cache incident', () => {
      const suggestions = service.suggestRemediationActions('Cache Hit Rate Degradation');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.actionType === 'clear_cache')).toBe(true);
    });

    it('should suggest actions for Resource incident', () => {
      const suggestions = service.suggestRemediationActions('High Resource Utilization Detected');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.actionType === 'scale_resources')).toBe(true);
    });
  });

  describe('getRemediationActions', () => {
    it('should retrieve remediation actions for incident', async () => {
      const mockActions: RemediationAction[] = [
        {
          id: 'action-1',
          incidentId: 'incident-1',
          actionType: 'restart_service',
          description: 'Restart service',
          status: RemediationStatus.COMPLETED,
          parameters: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          executedAt: new Date(),
          executionOutput: 'Success',
          errorMessage: null,
          autoRollback: false,
          rolledBackAt: null,
          incident: null,
        },
      ];

      jest.spyOn(repository, 'find').mockResolvedValue(mockActions);

      const result = await service.getRemediationActions('incident-1');

      expect(result).toEqual(mockActions);
      expect(repository.find).toHaveBeenCalledWith({
        where: { incidentId: 'incident-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
