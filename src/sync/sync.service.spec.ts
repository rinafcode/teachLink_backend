import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getQueueToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Queue } from 'bull';
import { DataSyncService } from './services/data-sync.service';
import { DataConsistencyService } from './services/data-consistency.service';
import { ConflictResolutionService } from './services/conflict-resolution.service';
import { CacheInvalidationService } from './services/cache-invalidation.service';
import { ReplicationService } from './services/replication.service';
import {
  SyncEvent,
  SyncEventType,
  SyncStatus,
  DataSource,
} from './entities/sync-event.entity';
import {
  ConflictLog,
  ConflictType,
  ResolutionStrategy,
} from './entities/conflict-log.entity';
import {
  IntegrityCheck,
  CheckType,
  CheckStatus,
} from './entities/integrity-check.entity';
import { jest } from '@jest/globals';

describe('DataSyncService', () => {
  let service: DataSyncService;
  let syncEventRepository: Repository<SyncEvent>;
  let syncQueue: Queue;

  const mockSyncEventRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  const mockSyncQueue = {
    add: jest.fn(),
  };

  const mockDataConsistencyService = {
    performConsistencyCheck: jest.fn(),
  };

  const mockConflictResolutionService = {
    resolveConflict: jest.fn(),
  };

  const mockCacheInvalidationService = {
    invalidateEntity: jest.fn(),
  };

  const mockReplicationService = {
    replicateEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataSyncService,
        {
          provide: getRepositoryToken(SyncEvent),
          useValue: mockSyncEventRepository,
        },
        {
          provide: getQueueToken('sync-queue'),
          useValue: mockSyncQueue,
        },
        {
          provide: DataConsistencyService,
          useValue: mockDataConsistencyService,
        },
        {
          provide: ConflictResolutionService,
          useValue: mockConflictResolutionService,
        },
        {
          provide: CacheInvalidationService,
          useValue: mockCacheInvalidationService,
        },
        {
          provide: ReplicationService,
          useValue: mockReplicationService,
        },
      ],
    }).compile();

    service = module.get<DataSyncService>(DataSyncService);
    syncEventRepository = module.get<Repository<SyncEvent>>(
      getRepositoryToken(SyncEvent),
    );
    syncQueue = module.get<Queue>(getQueueToken('sync-queue'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSyncEvent', () => {
    it('should create and queue a sync event', async () => {
      const mockSyncEvent = {
        id: 'test-sync-id',
        entityType: 'User',
        entityId: 'user-123',
        eventType: SyncEventType.UPDATE,
        payload: { name: 'John Doe' },
        version: 1234567890001,
        status: SyncStatus.PENDING,
      };

      mockSyncEventRepository.create.mockReturnValue(mockSyncEvent);
      mockSyncEventRepository.save.mockResolvedValue(mockSyncEvent);
      mockSyncQueue.add.mockResolvedValue({});

      jest
        .spyOn(service as any, 'generateVersion')
        .mockResolvedValue(1234567890001);

      const result = await service.createSyncEvent(
        'User',
        'user-123',
        SyncEventType.UPDATE,
        { name: 'John Doe' },
        DataSource.PRIMARY_DB,
        'us-east-1',
      );

      expect(result).toBe('test-sync-id');
      expect(mockSyncEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'User',
          entityId: 'user-123',
          eventType: SyncEventType.UPDATE,
          dataSource: DataSource.PRIMARY_DB,
          region: 'us-east-1',
          payload: { name: 'John Doe' },
          version: 1234567890001,
          status: SyncStatus.PENDING,
        }),
      );
      expect(mockSyncQueue.add).toHaveBeenCalledWith(
        'process-sync-event',
        { syncEventId: 'test-sync-id' },
        expect.any(Object),
      );
    });
  });

  describe('processSyncEvent', () => {
    it('should process sync event successfully', async () => {
      const mockSyncEvent = {
        id: 'test-sync-id',
        entityType: 'User',
        entityId: 'user-123',
        eventType: SyncEventType.UPDATE,
        payload: { name: 'John Doe' },
        version: 1234567890001,
        status: SyncStatus.PENDING,
      };

      const mockConfig = {
        entityType: 'User',
        dataSources: [
          { name: 'primary', type: 'database', readOnly: false },
          { name: 'cache', type: 'cache', readOnly: false },
        ],
        conflictResolution: { strategy: 'last_write_wins' },
        replication: { enabled: true, regions: ['us-west-1'] },
        caching: { enabled: true, invalidationStrategy: 'immediate' },
      };

      mockSyncEventRepository.findOne.mockResolvedValue(mockSyncEvent);
      service.registerSyncConfiguration(mockConfig);

      jest.spyOn(service as any, 'detectConflicts').mockResolvedValue(false);
      jest
        .spyOn(service as any, 'syncToDataSource')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'updateSyncEventStatus')
        .mockResolvedValue(undefined);

      const result = await service.processSyncEvent('test-sync-id');

      expect(result.success).toBe(true);
      expect(result.syncedRecords).toBe(2);
      expect(result.conflicts).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockCacheInvalidationService.invalidateEntity).toHaveBeenCalled();
      expect(mockReplicationService.replicateEvent).toHaveBeenCalled();
    });

    it('should handle conflicts during sync', async () => {
      const mockSyncEvent = {
        id: 'test-sync-id',
        entityType: 'User',
        entityId: 'user-123',
        eventType: SyncEventType.UPDATE,
        payload: { name: 'John Doe' },
        version: 1234567890001,
        status: SyncStatus.PENDING,
      };

      const mockConfig = {
        entityType: 'User',
        dataSources: [{ name: 'primary', type: 'database', readOnly: false }],
        conflictResolution: { strategy: 'last_write_wins' },
        replication: { enabled: false },
        caching: { enabled: false },
      };

      mockSyncEventRepository.findOne.mockResolvedValue(mockSyncEvent);
      service.registerSyncConfiguration(mockConfig);

      jest.spyOn(service as any, 'detectConflicts').mockResolvedValue(true);
      mockConflictResolutionService.resolveConflict.mockResolvedValue({
        resolved: true,
        resolvedData: { name: 'Jane Doe' },
        strategy: 'last_write_wins',
        reason: 'Used latest timestamp',
      });
      jest
        .spyOn(service as any, 'syncToDataSource')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'updateSyncEventStatus')
        .mockResolvedValue(undefined);

      const result = await service.processSyncEvent('test-sync-id');

      expect(result.success).toBe(true);
      expect(mockConflictResolutionService.resolveConflict).toHaveBeenCalled();
    });
  });

  describe('bulkSync', () => {
    it('should process multiple entities in batches', async () => {
      const entityIds = Array.from({ length: 250 }, (_, i) => `entity-${i}`);

      jest.spyOn(service, 'syncEntity').mockResolvedValue({
        success: true,
        syncedRecords: 1,
        conflicts: 0,
        errors: [],
        duration: 100,
      });

      const result = await service.bulkSync(
        'User',
        entityIds,
        DataSource.PRIMARY_DB,
      );

      expect(result.successful).toBe(250);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('ConflictResolutionService', () => {
  let service: ConflictResolutionService;
  let conflictLogRepository: Repository<ConflictLog>;

  const mockConflictLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConflictResolutionService,
        {
          provide: getRepositoryToken(ConflictLog),
          useValue: mockConflictLogRepository,
        },
      ],
    }).compile();

    service = module.get<ConflictResolutionService>(ConflictResolutionService);
    conflictLogRepository = module.get<Repository<ConflictLog>>(
      getRepositoryToken(ConflictLog),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveConflict', () => {
    it('should resolve conflict using last write wins strategy', async () => {
      const conflictingData = {
        source1: {
          id: 'user-123',
          name: 'John Doe',
          updatedAt: '2023-01-01T10:00:00Z',
        },
        source2: {
          id: 'user-123',
          name: 'Jane Doe',
          updatedAt: '2023-01-01T11:00:00Z',
        },
      };

      const mockConflictLog = {
        id: 'conflict-123',
        entityType: 'User',
        entityId: 'user-123',
        conflictType: ConflictType.CONCURRENT_UPDATE,
        resolutionStrategy: ResolutionStrategy.LAST_WRITE_WINS,
      };

      mockConflictLogRepository.create.mockReturnValue(mockConflictLog);
      mockConflictLogRepository.save.mockResolvedValue(mockConflictLog);
      mockConflictLogRepository.update.mockResolvedValue({});

      const result = await service.resolveConflict(
        'User',
        'user-123',
        conflictingData,
        {
          strategy: 'last_write_wins',
        },
      );

      expect(result.resolved).toBe(true);
      expect(result.strategy).toBe('last_write_wins');
      expect(result.resolvedData.name).toBe('Jane Doe'); // Later timestamp
      expect(result.reason).toContain('latest timestamp');
    });

    it('should resolve conflict using merge strategy', async () => {
      const conflictingData = {
        source1: {
          id: 'user-123',
          name: 'John Doe',
          email: 'john@example.com',
          updatedAt: '2023-01-01T10:00:00Z',
        },
        source2: {
          id: 'user-123',
          name: 'Jane Doe',
          phone: '+1234567890',
          updatedAt: '2023-01-01T11:00:00Z',
        },
      };

      const mockConflictLog = {
        id: 'conflict-123',
        entityType: 'User',
        entityId: 'user-123',
        conflictType: ConflictType.DATA_INCONSISTENCY,
        resolutionStrategy: ResolutionStrategy.MERGE,
      };

      mockConflictLogRepository.create.mockReturnValue(mockConflictLog);
      mockConflictLogRepository.save.mockResolvedValue(mockConflictLog);
      mockConflictLogRepository.update.mockResolvedValue({});

      const result = await service.resolveConflict(
        'User',
        'user-123',
        conflictingData,
        {
          strategy: 'merge',
          mergeFields: ['phone'],
        },
      );

      expect(result.resolved).toBe(true);
      expect(result.strategy).toBe('merge');
      expect(result.resolvedData.name).toBe('Jane Doe'); // Latest for conflicting field
      expect(result.resolvedData.email).toBe('john@example.com'); // Non-conflicting field
      expect(result.resolvedData.phone).toBe('+1234567890'); // Merged field
    });
  });

  describe('detectConflict', () => {
    it('should detect version conflict', async () => {
      const newData = { id: 'user-123', name: 'John', version: 1 };
      const existingData = { id: 'user-123', name: 'Jane', version: 2 };

      const conflictType = await service.detectConflict(
        'User',
        'user-123',
        newData,
        existingData,
      );

      expect(conflictType).toBe(ConflictType.VERSION_CONFLICT);
    });

    it('should detect concurrent update', async () => {
      const now = new Date();
      const newData = {
        id: 'user-123',
        name: 'John',
        updatedAt: now.toISOString(),
      };
      const existingData = {
        id: 'user-123',
        name: 'Jane',
        updatedAt: new Date(now.getTime() + 500).toISOString(), // 500ms later
      };

      const conflictType = await service.detectConflict(
        'User',
        'user-123',
        newData,
        existingData,
      );

      expect(conflictType).toBe(ConflictType.CONCURRENT_UPDATE);
    });
  });
});

describe('DataConsistencyService', () => {
  let service: DataConsistencyService;
  let integrityCheckRepository: Repository<IntegrityCheck>;

  const mockIntegrityCheckRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataConsistencyService,
        {
          provide: getRepositoryToken(IntegrityCheck),
          useValue: mockIntegrityCheckRepository,
        },
      ],
    }).compile();

    service = module.get<DataConsistencyService>(DataConsistencyService);
    integrityCheckRepository = module.get<Repository<IntegrityCheck>>(
      getRepositoryToken(IntegrityCheck),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('performConsistencyCheck', () => {
    it('should perform consistency check and return results', async () => {
      const mockCheck = {
        id: 'check-123',
        entityType: 'User',
        checkType: CheckType.CONSISTENCY,
        status: CheckStatus.RUNNING,
      };

      mockIntegrityCheckRepository.create.mockReturnValue(mockCheck);
      mockIntegrityCheckRepository.save.mockResolvedValue(mockCheck);
      mockIntegrityCheckRepository.update.mockResolvedValue({});

      jest.spyOn(service, 'checkDataConsistency').mockResolvedValue({
        passed: true,
        recordsChecked: 100,
        inconsistencies: [],
        warnings: [],
      });

      const result = await service.performConsistencyCheck('User', [
        'primary_db',
        'cache',
      ]);

      expect(result.passed).toBe(true);
      expect(result.recordsChecked).toBe(100);
      expect(result.inconsistencies).toHaveLength(0);
      expect(mockIntegrityCheckRepository.update).toHaveBeenCalledWith(
        'check-123',
        expect.objectContaining({
          status: CheckStatus.PASSED,
          recordsChecked: 100,
          inconsistenciesFound: 0,
        }),
      );
    });

    it('should handle consistency check failures', async () => {
      const mockCheck = {
        id: 'check-123',
        entityType: 'User',
        checkType: CheckType.CONSISTENCY,
        status: CheckStatus.RUNNING,
      };

      mockIntegrityCheckRepository.create.mockReturnValue(mockCheck);
      mockIntegrityCheckRepository.save.mockResolvedValue(mockCheck);
      mockIntegrityCheckRepository.update.mockResolvedValue({});

      jest.spyOn(service, 'checkDataConsistency').mockResolvedValue({
        passed: false,
        recordsChecked: 100,
        inconsistencies: [
          {
            entityId: 'user-123',
            field: 'name',
            expected: 'John',
            actual: 'Jane',
            sources: ['primary_db', 'cache'],
          },
        ],
        warnings: [],
      });

      const result = await service.performConsistencyCheck('User', [
        'primary_db',
        'cache',
      ]);

      expect(result.passed).toBe(false);
      expect(result.inconsistencies).toHaveLength(1);
      expect(mockIntegrityCheckRepository.update).toHaveBeenCalledWith(
        'check-123',
        expect.objectContaining({
          status: CheckStatus.FAILED,
          inconsistenciesFound: 1,
        }),
      );
    });
  });
});

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;
  let syncQueue: Queue;

  const mockSyncQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInvalidationService,
        {
          provide: getQueueToken('sync-queue'),
          useValue: mockSyncQueue,
        },
      ],
    }).compile();

    service = module.get<CacheInvalidationService>(CacheInvalidationService);
    syncQueue = module.get<Queue>(getQueueToken('sync-queue'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('invalidateEntity', () => {
    it('should perform immediate invalidation', async () => {
      const mockProvider = {
        del: jest.fn().mockResolvedValue(true),
      };

      await service.registerCacheProvider('redis', mockProvider);
      await service.registerInvalidationStrategy('User', {
        immediate: true,
        lazy: false,
        scheduled: false,
        tags: ['user'],
        dependencies: [],
      });

      await service.invalidateEntity('User', 'user-123', 'immediate');

      expect(mockProvider.del).toHaveBeenCalledWith('User:user-123');
    });

    it('should perform lazy invalidation', async () => {
      const mockProvider = {
        markStale: jest.fn().mockResolvedValue(true),
      };

      await service.registerCacheProvider('redis', mockProvider);

      await service.invalidateEntity('User', 'user-123', 'lazy');

      expect(mockProvider.markStale).toHaveBeenCalledWith('User:user-123');
    });

    it('should schedule invalidation', async () => {
      await service.invalidateEntity('User', 'user-123', 'scheduled');

      expect(mockSyncQueue.add).toHaveBeenCalledWith(
        'cache-invalidation',
        expect.objectContaining({
          cacheKey: 'User:user-123',
        }),
        expect.objectContaining({
          delay: 5000,
          attempts: 3,
        }),
      );
    });
  });

  describe('bulkInvalidate', () => {
    it('should invalidate multiple entities in batches', async () => {
      const entities = Array.from({ length: 250 }, (_, i) => ({
        entityType: 'User',
        entityId: `user-${i}`,
      }));

      const mockProvider = {
        del: jest.fn().mockResolvedValue(true),
      };

      await service.registerCacheProvider('redis', mockProvider);

      await service.bulkInvalidate(entities, 'immediate');

      expect(mockProvider.del).toHaveBeenCalledTimes(250);
    });
  });
});
