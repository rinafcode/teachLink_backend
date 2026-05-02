import { MigrationService, IMigrationConfig } from './migration.service';
import { Migration, MigrationStatus } from './entities/migration.entity';
import { DataSource, QueryRunner, Repository } from 'typeorm';

const makeMigration = (overrides: Partial<IMigrationConfig> = {}): IMigrationConfig => ({
  name: 'test-migration',
  version: '1.0.0',
  dependencies: [],
  up: jest.fn().mockResolvedValue(undefined),
  down: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const makeQueryRunner = (): jest.Mocked<QueryRunner> =>
  ({
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<QueryRunner>;

const makeMockRepo = (): jest.Mocked<Repository<Migration>> =>
  ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  }) as unknown as jest.Mocked<Repository<Migration>>;

describe('MigrationService', () => {
  let service: MigrationService;
  let mockRepo: jest.Mocked<Repository<Migration>>;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockQueryRunner: jest.Mocked<QueryRunner>;
  let mockConflictService: any;
  let mockSchemaValidation: any;
  let mockRollbackService: any;
  let mockEnvSync: any;

  beforeEach(() => {
    mockRepo = makeMockRepo();
    mockQueryRunner = makeQueryRunner();
    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    } as unknown as jest.Mocked<DataSource>;

    mockConflictService = {
      checkForConflicts: jest.fn().mockResolvedValue(false),
      resolveConflict: jest.fn().mockResolvedValue(null),
    };
    mockSchemaValidation = {
      validateBeforeMigration: jest.fn().mockResolvedValue(true),
      validateAfterMigration: jest.fn().mockResolvedValue(true),
    };
    mockRollbackService = {
      rollbackMigration: jest.fn().mockResolvedValue(undefined),
    };
    mockEnvSync = {
      syncAfterMigration: jest.fn().mockResolvedValue(undefined),
    };

    service = new MigrationService(
      mockRepo,
      mockDataSource,
      mockConflictService,
      mockSchemaValidation,
      mockRollbackService,
      mockEnvSync,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('runPendingMigrations', () => {
    it('skips already-applied migrations', async () => {
      const applied = Object.assign(new Migration(), {
        name: 'test-migration',
        version: '1.0.0',
        status: MigrationStatus.COMPLETED,
      });
      mockRepo.find.mockResolvedValue([applied]);
      jest
        .spyOn(service as any, 'getRegisteredMigrations')
        .mockReturnValue([makeMigration({ name: 'test-migration' })]);

      await service.runPendingMigrations();

      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('executes pending migrations in order', async () => {
      mockRepo.find.mockResolvedValue([]);
      mockRepo.save.mockResolvedValue({} as Migration);

      const m1 = makeMigration({ name: 'mig-001' });
      const m2 = makeMigration({ name: 'mig-002' });
      jest.spyOn(service as any, 'getRegisteredMigrations').mockReturnValue([m1, m2]);

      await service.runPendingMigrations();

      expect(m1.up).toHaveBeenCalledWith(mockQueryRunner);
      expect(m2.up).toHaveBeenCalledWith(mockQueryRunner);
    });

    it('throws when a dependency is not yet applied', async () => {
      mockRepo.find.mockResolvedValue([]);
      const m = makeMigration({ name: 'mig-002', dependencies: ['mig-001'] });
      jest.spyOn(service as any, 'getRegisteredMigrations').mockReturnValue([m]);

      await expect(service.runPendingMigrations()).rejects.toThrow(
        'Dependency not met for migration: mig-002',
      );
    });
  });

  describe('executeMigration (via runPendingMigrations)', () => {
    beforeEach(() => {
      mockRepo.find.mockResolvedValue([]);
      mockRepo.save.mockResolvedValue({} as Migration);
    });

    it('validates schema before and after migration', async () => {
      jest.spyOn(service as any, 'getRegisteredMigrations').mockReturnValue([makeMigration()]);

      await service.runPendingMigrations();

      expect(mockSchemaValidation.validateBeforeMigration).toHaveBeenCalledTimes(1);
      expect(mockSchemaValidation.validateAfterMigration).toHaveBeenCalledTimes(1);
    });

    it('wraps migration in a transaction and commits on success', async () => {
      jest.spyOn(service as any, 'getRegisteredMigrations').mockReturnValue([makeMigration()]);

      await service.runPendingMigrations();

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('rolls back transaction and calls rollbackService on migration failure', async () => {
      const failingMigration = makeMigration();
      (failingMigration.up as jest.Mock).mockRejectedValue(new Error('SQL error'));
      jest.spyOn(service as any, 'getRegisteredMigrations').mockReturnValue([failingMigration]);

      await expect(service.runPendingMigrations()).rejects.toThrow('SQL error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockRollbackService.rollbackMigration).toHaveBeenCalledWith(failingMigration);
    });

    it('resolves conflicts when detected', async () => {
      mockConflictService.checkForConflicts.mockResolvedValue(true);
      jest.spyOn(service as any, 'getRegisteredMigrations').mockReturnValue([makeMigration()]);

      await service.runPendingMigrations();

      expect(mockConflictService.resolveConflict).toHaveBeenCalled();
    });

    it('saves migration record with COMPLETED status', async () => {
      jest
        .spyOn(service as any, 'getRegisteredMigrations')
        .mockReturnValue([makeMigration({ name: 'mig-001', version: '2.0.0' })]);

      await service.runPendingMigrations();

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'mig-001',
          version: '2.0.0',
          status: MigrationStatus.COMPLETED,
        }),
      );
    });
  });

  describe('listMigrations', () => {
    it('returns applied migrations with their status', async () => {
      const applied = Object.assign(new Migration(), {
        name: 'mig-001',
        version: '1.0.0',
        status: MigrationStatus.COMPLETED,
        appliedAt: new Date('2024-01-01'),
      });
      mockRepo.find.mockResolvedValue([applied]);
      jest.spyOn(service as any, 'getRegisteredMigrations').mockReturnValue([]);

      const result = await service.listMigrations();

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'mig-001', status: MigrationStatus.COMPLETED }),
        ]),
      );
    });

    it('includes pending migrations not yet applied', async () => {
      mockRepo.find.mockResolvedValue([]);
      jest
        .spyOn(service as any, 'getRegisteredMigrations')
        .mockReturnValue([makeMigration({ name: 'mig-pending' })]);

      const result = await service.listMigrations();

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'mig-pending', status: MigrationStatus.PENDING }),
        ]),
      );
    });
  });
});
