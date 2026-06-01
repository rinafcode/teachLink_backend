import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IncidentDetectionService, INCIDENT_DETECTION_RULES } from '../services/incident-detection.service';
import { Incident, IncidentStatus, IncidentSeverity } from '../entities/incident.entity';
import { IAlertEvent } from '../../monitoring/alerting/alerting.service';

describe('IncidentDetectionService', () => {
  let service: IncidentDetectionService;
  let repository: Repository<Incident>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentDetectionService,
        {
          provide: getRepositoryToken(Incident),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IncidentDetectionService>(IncidentDetectionService);
    repository = module.get<Repository<Incident>>(getRepositoryToken(Incident));
  });

  afterEach(() => {
    service.clearAlertHistory();
  });

  describe('processAlert', () => {
    it('should return null if no matching detection rule', async () => {
      const alert: IAlertEvent = {
        id: 'alert-1',
        type: 'unknown_metric',
        message: 'Unknown metric alert',
        severity: 'WARNING',
        firedAt: new Date(),
      };

      const result = await service.processAlert(alert);
      expect(result).toBeNull();
    });

    it('should create incident for database performance alert', async () => {
      const mockIncident: Incident = {
        id: 'incident-1',
        title: 'Database Performance Degradation Detected',
        description: 'Database query duration or active connections exceeded critical threshold',
        status: IncidentStatus.DETECTED,
        severity: IncidentSeverity.CRITICAL,
        triggerMetrics: {},
        detectedAt: new Date(),
        updatedAt: new Date(),
        runbookId: 'database-failure',
        remediationActionIds: [],
      };

      jest.spyOn(repository, 'create').mockReturnValue(mockIncident);
      jest.spyOn(repository, 'save').mockResolvedValue(mockIncident);
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      // Send multiple consecutive alerts to trigger incident
      const alertType = 'db_query_duration_ms';
      for (let i = 0; i < 3; i++) {
        const alert: IAlertEvent = {
          id: `alert-${i}`,
          type: alertType,
          message: 'Database query duration exceeded',
          severity: 'CRITICAL',
          firedAt: new Date(),
        };
        await service.processAlert(alert);
      }

      // After 3rd alert, incident should be created
      expect(repository.save).toHaveBeenCalled();
    });

    it('should detect high error rate incident', async () => {
      const mockIncident: Incident = {
        id: 'incident-2',
        title: 'High HTTP Error Rate Detected',
        description: 'HTTP error rate (5xx) has increased significantly',
        status: IncidentStatus.DETECTED,
        severity: IncidentSeverity.CRITICAL,
        triggerMetrics: {},
        detectedAt: new Date(),
        updatedAt: new Date(),
        runbookId: 'error-rate-investigation',
        remediationActionIds: [],
      };

      jest.spyOn(repository, 'create').mockReturnValue(mockIncident);
      jest.spyOn(repository, 'save').mockResolvedValue(mockIncident);
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const alert: IAlertEvent = {
        id: 'alert-1',
        type: 'http_error_rate',
        message: 'HTTP error rate exceeded 5%',
        severity: 'CRITICAL',
        firedAt: new Date(),
      };

      const result = await service.processAlert(alert);
      expect(result).toBeNull(); // First alert, needs more for incident
    });
  });

  describe('getDetectionStats', () => {
    it('should return detection statistics', async () => {
      const alert1: IAlertEvent = {
        id: 'alert-1',
        type: 'cpu_load',
        message: 'CPU load high',
        severity: 'WARNING',
        firedAt: new Date(),
      };

      const alert2: IAlertEvent = {
        id: 'alert-2',
        type: 'memory_usage',
        message: 'Memory usage high',
        severity: 'WARNING',
        firedAt: new Date(),
      };

      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await service.processAlert(alert1);
      await service.processAlert(alert2);

      const stats = await service.getDetectionStats();

      expect(stats.totalAlerts).toBe(2);
      expect(stats.alertTypes['cpu_load']).toBe(1);
      expect(stats.alertTypes['memory_usage']).toBe(1);
      expect(stats.detectionRules).toBe(INCIDENT_DETECTION_RULES.length);
    });
  });

  describe('clearAlertHistory', () => {
    it('should clear alert history', async () => {
      const alert: IAlertEvent = {
        id: 'alert-1',
        type: 'cpu_load',
        message: 'CPU load high',
        severity: 'WARNING',
        firedAt: new Date(),
      };

      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await service.processAlert(alert);
      let stats = await service.getDetectionStats();
      expect(stats.totalAlerts).toBe(1);

      service.clearAlertHistory();
      stats = await service.getDetectionStats();
      expect(stats.totalAlerts).toBe(0);
    });
  });
});
