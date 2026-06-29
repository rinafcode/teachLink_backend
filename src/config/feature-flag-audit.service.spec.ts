import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '../audit-log/audit-log.service';
import { FeatureFlagAuditService } from './feature-flag-audit.service';

const mockAuditLogService: jest.Mocked<Pick<AuditLogService, 'logDataChange'>> = {
  logDataChange: jest.fn().mockResolvedValue({}),
};

const ACTOR = { id: 'admin-1', email: 'admin@example.com' };

describe('FeatureFlagAuditService', () => {
  let service: FeatureFlagAuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagAuditService,
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get(FeatureFlagAuditService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getFlag / getAllFlags', () => {
    it('returns the initial value loaded from config', () => {
      // ENABLE_AUTH defaults to true in feature-flags.config
      expect(service.getFlag('ENABLE_AUTH')).toBe(true);
    });

    it('returns undefined for an unknown key', () => {
      expect(service.getFlag('UNKNOWN_KEY' as any)).toBeUndefined();
    });

    it('getAllFlags includes all known flags', () => {
      const flags = service.getAllFlags();
      expect(Object.keys(flags).length).toBeGreaterThan(0);
      expect(typeof flags['ENABLE_AUTH']).toBe('boolean');
    });
  });

  describe('setFlag', () => {
    it('updates the in-process flag value', async () => {
      await service.setFlag('ENABLE_SEARCH', false, ACTOR);
      expect(service.getFlag('ENABLE_SEARCH')).toBe(false);
    });

    it('records the change in the audit history', async () => {
      await service.setFlag('ENABLE_GAMIFICATION', false, ACTOR);
      const history = service.getAuditHistory();
      expect(history[0]).toMatchObject({
        flagKey: 'ENABLE_GAMIFICATION',
        newValue: false,
        actor: ACTOR.id,
        actorEmail: ACTOR.email,
      });
    });

    it('captures the old value before the change', async () => {
      // ENABLE_AUTH starts as true
      await service.setFlag('ENABLE_AUTH', false, ACTOR);
      expect(service.getAuditHistory()[0].oldValue).toBe(true);
    });

    it('calls AuditLogService.logDataChange on each toggle', async () => {
      await service.setFlag('ENABLE_CACHING', false, ACTOR);
      expect(mockAuditLogService.logDataChange).toHaveBeenCalledTimes(1);
      expect(mockAuditLogService.logDataChange).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'FeatureFlag',
          entityId: 'ENABLE_CACHING',
          oldValues: { value: true },
          newValues: { value: false },
        }),
      );
    });

    it('emits a separate audit entry for each toggle', async () => {
      await service.setFlag('ENABLE_NOTIFICATIONS', false, ACTOR);
      await service.setFlag('ENABLE_NOTIFICATIONS', true, ACTOR);
      expect(mockAuditLogService.logDataChange).toHaveBeenCalledTimes(2);
      expect(service.getAuditHistory()).toHaveLength(2);
    });

    it('does not throw when AuditLogService fails', async () => {
      mockAuditLogService.logDataChange.mockRejectedValueOnce(new Error('DB down'));
      await expect(service.setFlag('ENABLE_BACKUP', false, ACTOR)).resolves.not.toThrow();
    });
  });

  describe('getAuditHistory', () => {
    it('returns entries newest-first', async () => {
      await service.setFlag('ENABLE_AUTH', false, ACTOR);
      await service.setFlag('ENABLE_PAYMENTS', false, ACTOR);
      const history = service.getAuditHistory();
      expect(history[0].flagKey).toBe('ENABLE_PAYMENTS');
      expect(history[1].flagKey).toBe('ENABLE_AUTH');
    });

    it('caps history at MAX_HISTORY entries', async () => {
      const toggles = FeatureFlagAuditService.MAX_HISTORY + 10;
      for (let i = 0; i < toggles; i++) {
        await service.setFlag('ENABLE_AUTH', i % 2 === 0, ACTOR);
      }
      expect(service.getAuditHistory()).toHaveLength(FeatureFlagAuditService.MAX_HISTORY);
    });

    it('returns a snapshot (modifying the returned array does not affect internal state)', async () => {
      await service.setFlag('ENABLE_SEARCH', false, ACTOR);
      const snapshot = service.getAuditHistory();
      snapshot.pop();
      expect(service.getAuditHistory()).toHaveLength(1);
    });
  });
});
