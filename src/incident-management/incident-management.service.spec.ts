import { IncidentManagementService } from './incident-management.service';
import { Incident, IncidentStatus, IncidentSeverity } from './entities/incident.entity';
import { RemediationAction, RemediationStatus } from './entities/remediation-action.entity';

describe('IncidentManagementService', () => {
  let service: IncidentManagementService;
  let incidentRepository: Record<string, jest.Mock>;
  let remediationRepository: Record<string, jest.Mock>;
  let runbookRepository: Record<string, jest.Mock>;
  let incidentDetectionService: Record<string, jest.Mock>;
  let autoRemediationService: Record<string, jest.Mock>;
  let runbookExecutionService: Record<string, jest.Mock>;
  let notificationService: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };

  const baseIncident = (overrides: Partial<Incident> = {}): Incident =>
    ({
      id: 'incident-1',
      title: 'High error rate',
      description: 'Errors exceeded threshold',
      status: IncidentStatus.DETECTED,
      severity: IncidentSeverity.CRITICAL,
      triggerMetrics: {},
      runbookId: null,
      remediationActionIds: [],
      escalatedTo: null,
      resolutionNotes: null,
      detectedAt: new Date('2026-01-01T00:00:00Z'),
      resolvedAt: null,
      ...overrides,
    }) as Incident;

  beforeEach(() => {
    incidentRepository = {
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((incident) => Promise.resolve(incident)),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      count: jest.fn(),
      countBy: jest.fn(),
    };
    remediationRepository = {};
    runbookRepository = {};
    incidentDetectionService = {
      processAlert: jest.fn(),
      getDetectionStats: jest.fn(),
    };
    autoRemediationService = {
      suggestRemediationActions: jest.fn().mockReturnValue([]),
      executeRemediationAction: jest.fn(),
      getRemediationActions: jest.fn(),
      rollbackRemediationAction: jest.fn(),
    };
    runbookExecutionService = {
      executeRunbook: jest.fn(),
      getRunbookExecutionsForIncident: jest.fn(),
      listAvailableRunbooks: jest.fn(),
    };
    notificationService = {
      notifyIncidentDetected: jest.fn(),
      notifyRemediationExecuted: jest.fn(),
      notifyIncidentResolved: jest.fn(),
      escalateIncident: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(async (cb: (manager: unknown) => Promise<void>) => {
        const manager = { getRepository: jest.fn().mockReturnValue(incidentRepository) };
        return cb(manager);
      }),
    };

    service = new IncidentManagementService(
      incidentRepository as never,
      remediationRepository as never,
      runbookRepository as never,
      incidentDetectionService as never,
      autoRemediationService as never,
      runbookExecutionService as never,
      notificationService as never,
      dataSource as never,
    );
  });

  describe('processAlert', () => {
    const alert = { type: 'high_error_rate' } as never;

    it('returns null and does nothing further when no incident is detected', async () => {
      incidentDetectionService.processAlert.mockResolvedValue(null);

      const result = await service.processAlert(alert);

      expect(result).toBeNull();
      expect(notificationService.notifyIncidentDetected).not.toHaveBeenCalled();
      expect(autoRemediationService.suggestRemediationActions).not.toHaveBeenCalled();
    });

    it('notifies detection and skips auto-remediation for an INFO-severity incident', async () => {
      const incident = baseIncident({ severity: IncidentSeverity.INFO });
      incidentDetectionService.processAlert.mockResolvedValue(incident);

      const result = await service.processAlert(alert);

      expect(result).toBe(incident);
      expect(notificationService.notifyIncidentDetected).toHaveBeenCalledWith(incident);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('runs remediation inside a transaction and notifies only after it commits', async () => {
      const incident = baseIncident();
      incidentDetectionService.processAlert.mockResolvedValue(incident);

      const remediationAction = {
        id: 'action-1',
        status: RemediationStatus.COMPLETED,
      } as RemediationAction;

      autoRemediationService.suggestRemediationActions.mockReturnValue([
        { actionType: 'restart_service', description: 'Restart', parameters: {}, autoRollback: false },
      ]);
      autoRemediationService.executeRemediationAction.mockResolvedValue(remediationAction);

      await service.processAlert(alert);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(autoRemediationService.executeRemediationAction).toHaveBeenCalledWith(
        incident,
        'restart_service',
        'Restart',
        {},
        false,
        expect.anything(),
      );
      expect(incident.remediationActionIds).toEqual(['action-1']);
      expect(notificationService.notifyRemediationExecuted).toHaveBeenCalledWith(
        incident,
        remediationAction,
      );
      expect(autoRemediationService.rollbackRemediationAction).not.toHaveBeenCalled();
    });

    it('auto-rolls back a failed remediation action when autoRollback is set', async () => {
      const incident = baseIncident();
      incidentDetectionService.processAlert.mockResolvedValue(incident);

      const failedAction = { id: 'action-2', status: RemediationStatus.FAILED } as RemediationAction;
      autoRemediationService.suggestRemediationActions.mockReturnValue([
        { actionType: 'restart_service', description: 'Restart', parameters: {}, autoRollback: true },
      ]);
      autoRemediationService.executeRemediationAction.mockResolvedValue(failedAction);

      await service.processAlert(alert);

      expect(autoRemediationService.rollbackRemediationAction).toHaveBeenCalledWith(failedAction);
    });

    it('executes the runbook when the incident has one configured', async () => {
      const incident = baseIncident({ runbookId: 'runbook-1' });
      incidentDetectionService.processAlert.mockResolvedValue(incident);
      runbookExecutionService.executeRunbook.mockResolvedValue({
        id: 'run-1',
        status: 'completed',
      });

      await service.processAlert(alert);

      expect(runbookExecutionService.executeRunbook).toHaveBeenCalledWith(incident, 'runbook-1');
    });
  });

  describe('createIncident', () => {
    it('creates and persists a new incident', async () => {
      const dto = {
        title: 'New incident',
        description: 'desc',
        severity: IncidentSeverity.WARNING,
      };

      const result = await service.createIncident(dto);

      expect(incidentRepository.create).toHaveBeenCalledWith(dto);
      expect(incidentRepository.save).toHaveBeenCalled();
      expect(result.title).toBe('New incident');
    });
  });

  describe('updateIncident', () => {
    it('applies the update and stamps resolvedAt when moving to RESOLVED', async () => {
      const incident = baseIncident({ status: IncidentStatus.IN_PROGRESS, resolvedAt: null });
      incidentRepository.findOne.mockResolvedValue(incident);

      const result = await service.updateIncident('incident-1', {
        status: IncidentStatus.RESOLVED,
      });

      expect(result.status).toBe(IncidentStatus.RESOLVED);
      expect(result.resolvedAt).toBeInstanceOf(Date);
    });

    it('throws when the incident does not exist', async () => {
      incidentRepository.findOne.mockResolvedValue(null);

      await expect(service.updateIncident('missing', {})).rejects.toThrow('Incident not found');
    });
  });

  describe('getIncidentById', () => {
    it('returns the incident when found', async () => {
      const incident = baseIncident();
      incidentRepository.findOne.mockResolvedValue(incident);

      await expect(service.getIncidentById('incident-1')).resolves.toBe(incident);
    });

    it('returns null when not found', async () => {
      incidentRepository.findOne.mockResolvedValue(null);

      await expect(service.getIncidentById('missing')).resolves.toBeNull();
    });
  });

  describe('getIncidents', () => {
    it('applies status/severity filters and pagination', async () => {
      const incidents = [baseIncident()];
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([incidents, 1]),
      };
      incidentRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getIncidents({
        status: IncidentStatus.DETECTED,
        severity: IncidentSeverity.CRITICAL,
        skip: 0,
        take: 20,
      } as never);

      expect(qb.andWhere).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: incidents, total: 1 });
    });

    it('returns an empty page when there are no incidents', async () => {
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      incidentRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getIncidents({} as never);

      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('resolveIncident', () => {
    it('marks the incident resolved and notifies', async () => {
      const incident = baseIncident({ status: IncidentStatus.IN_PROGRESS });
      incidentRepository.findOne.mockResolvedValue(incident);

      const result = await service.resolveIncident('incident-1', 'Fixed the root cause');

      expect(result.status).toBe(IncidentStatus.RESOLVED);
      expect(result.resolutionNotes).toBe('Fixed the root cause');
      expect(notificationService.notifyIncidentResolved).toHaveBeenCalledWith(
        result,
        expect.any(Number),
      );
    });

    it('throws when the incident does not exist', async () => {
      incidentRepository.findOne.mockResolvedValue(null);

      await expect(service.resolveIncident('missing', 'notes')).rejects.toThrow(
        'Incident not found',
      );
    });
  });

  describe('escalateIncident', () => {
    it('escalates the incident and notifies', async () => {
      const incident = baseIncident();
      incidentRepository.findOne.mockResolvedValue(incident);

      const result = await service.escalateIncident('incident-1', 'on-call-team', 'SLA breach');

      expect(result.status).toBe(IncidentStatus.ESCALATED);
      expect(result.escalatedTo).toBe('on-call-team');
      expect(notificationService.escalateIncident).toHaveBeenCalledWith(
        result,
        'on-call-team',
        'SLA breach',
      );
    });

    it('throws when the incident does not exist', async () => {
      incidentRepository.findOne.mockResolvedValue(null);

      await expect(service.escalateIncident('missing', 'team', 'reason')).rejects.toThrow(
        'Incident not found',
      );
    });
  });

  describe('createRemediationAction', () => {
    it('creates a remediation action for an existing incident', async () => {
      const incident = baseIncident();
      incidentRepository.findOne.mockResolvedValue(incident);
      const action = { id: 'action-1' } as RemediationAction;
      autoRemediationService.executeRemediationAction.mockResolvedValue(action);

      const result = await service.createRemediationAction({
        incidentId: 'incident-1',
        actionType: 'restart_service',
        description: 'Restart',
      } as never);

      expect(result).toBe(action);
      expect(autoRemediationService.executeRemediationAction).toHaveBeenCalledWith(
        incident,
        'restart_service',
        'Restart',
        {},
        false,
      );
    });

    it('throws when the incident does not exist', async () => {
      incidentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createRemediationAction({ incidentId: 'missing' } as never),
      ).rejects.toThrow('Incident not found');
    });
  });

  describe('getRemediationActionsForIncident', () => {
    it('delegates to the auto-remediation service', async () => {
      const actions = [{ id: 'action-1' }] as RemediationAction[];
      autoRemediationService.getRemediationActions.mockResolvedValue(actions);

      await expect(service.getRemediationActionsForIncident('incident-1')).resolves.toBe(actions);
      expect(autoRemediationService.getRemediationActions).toHaveBeenCalledWith('incident-1');
    });
  });

  describe('executeRunbookForIncident', () => {
    it('executes the runbook for an existing incident', async () => {
      const incident = baseIncident();
      incidentRepository.findOne.mockResolvedValue(incident);
      const execution = { id: 'run-1' };
      runbookExecutionService.executeRunbook.mockResolvedValue(execution);

      const result = await service.executeRunbookForIncident('incident-1', 'restart-runbook');

      expect(result).toBe(execution);
      expect(runbookExecutionService.executeRunbook).toHaveBeenCalledWith(
        incident,
        'restart-runbook',
      );
    });

    it('throws when the incident does not exist', async () => {
      incidentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.executeRunbookForIncident('missing', 'restart-runbook'),
      ).rejects.toThrow('Incident not found');
    });
  });

  describe('getRunbookExecutionsForIncident', () => {
    it('delegates to the runbook execution service', async () => {
      const executions = [{ id: 'run-1' }];
      runbookExecutionService.getRunbookExecutionsForIncident.mockResolvedValue(executions);

      await expect(service.getRunbookExecutionsForIncident('incident-1')).resolves.toBe(
        executions,
      );
    });
  });

  describe('listAvailableRunbooks', () => {
    it('delegates to the runbook execution service', async () => {
      runbookExecutionService.listAvailableRunbooks.mockResolvedValue(['runbook-1']);

      await expect(service.listAvailableRunbooks()).resolves.toEqual(['runbook-1']);
    });
  });

  describe('getStatistics', () => {
    it('aggregates counts and detection stats', async () => {
      incidentRepository.count.mockResolvedValue(10);
      incidentRepository.countBy
        .mockResolvedValueOnce(3) // active
        .mockResolvedValueOnce(5) // resolved
        .mockResolvedValueOnce(2); // escalated
      incidentRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ severity: 'critical', count: '4' }]),
      });
      incidentDetectionService.getDetectionStats.mockResolvedValue({
        totalAlerts: 20,
        alertTypes: { high_error_rate: 20 },
        detectionRules: 3,
      });

      const stats = await service.getStatistics();

      expect(stats).toEqual({
        totalIncidents: 10,
        activeIncidents: 3,
        resolvedIncidents: 5,
        escalatedIncidents: 2,
        incidentsBySeverity: { critical: 4 },
        detectionStats: {
          totalAlerts: 20,
          alertTypes: { high_error_rate: 20 },
          detectionRules: 3,
        },
      });
    });
  });
});
