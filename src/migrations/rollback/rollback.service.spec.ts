import { RollbackService } from './rollback.service';
import { Migration, MigrationStatus } from '../entities/migration.entity';
import { IMigrationConfig } from '../migration.service';
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
  }) as unknown as jest.Mocked<Repository<Migration>>;

describe('RollbackService', () => {
  let service: RollbackService;
  let mockRepo: jest.Mocked<Repository<Migration>>;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockQueryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    mockRepo = makeMockRepo();
    mockQueryRunner = makeQueryRunner();
    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    } as unknown as jest.Mocked<DataSource>;

    service = new RollbackService(mockRepo, mockDataSource);
  });

  afterEach(() => jest.clearAllMocks());

  describe('rollbackMigration', () => {
    it('calls migration.down with the query runner', async () => {
      const migration = makeMigration();
      mockRepo.findOne.mockResolvedValue(null);

      await service.rollbackMigration(migration);

      expect(migration.down).toHaveBeenCalledWith(mockQueryRunner);
    });

    it('wraps rollback in a transaction and commits on success', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await service.rollbackMigration(makeMigration());

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('rolls back transaction when down() throws', async () => {
      const migration = makeMigration();
      (migration.down as jest.Mock).mockRejectedValue(new Error('down failed'));

      await expect(service.rollbackMigration(migration)).rejects.toThrow('down failed');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('updates migration record to ROLLED_BACK when record exists', async () => {
      const record = Object.assign(new Migration(), {
        name: 'test-migration',
        status: MigrationStatus.COMPLETED,
      });
      mockRepo.findOne.mockResolvedValue(record);
      mockRepo.save.mockResolvedValue(record);

      await service.rollbackMigration(makeMigration());

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: MigrationStatus.ROLLED_BACK }),
      );
    });

    it('does not throw when no migration record exists in DB', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.rollbackMigration(makeMigration())).resolves.not.toThrow();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('rollbackLastMigrations', () => {
    it('rolls back the last N completed migrations', async () => {
      const m1 = makeMigration({ name: 'mig-001' });
      const m2 = makeMigration({ name: 'mig-002' });

      const r1 = Object.assign(new Migration(), {
        name: 'mig-001',
        status: MigrationStatus.COMPLETED,
      });
      const r2 = Object.assign(new Migration(), {
        name: 'mig-002',
        status: MigrationStatus.COMPLETED,
      });

      mockRepo.find.mockResolvedValue([r2, r1]); // DESC order
      mockRepo.findOne.mockResolvedValue(null);
      jest.spyOn(service as any, 'getRegisteredMigrations').mockReturnValue([m1, m2]);

      await service.rollbackLastMigrations(2);

      expect(m2.down).toHaveBeenCalled();
      expect(m1.down).toHaveBeenCalled();
    });

    it('defaults to rolling back 1 migration', async () => {
      const m = makeMigration({ name: 'mig-001' });
      const r = Object.assign(new Migration(), {
        name: 'mig-001',
        status: MigrationStatus.COMPLETED,
      });

      mockRepo.find.mockResolvedValue([r]);
      mockRepo.findOne.mockResolvedValue(null);
      jest.spyOn(service as any, 'getRegisteredMigrations').mockReturnValue([m]);

      await service.rollbackLastMigrations();

      expect(m.down).toHaveBeenCalledTimes(1);
    });
  });

  describe('rollbackByName', () => {
    it('throws when migration is not in registry', async () => {
      jest.spyOn(service as any, 'getRegisteredMigrations').mockReturnValue([]);

      await expect(service.rollbackByName('unknown')).rejects.toThrow(
        'Migration not found in registry: unknown',
      );
    });

    it('throws when migration has not been applied', async () => {
      const m = makeMigration({ name: 'mig-001' });
      jest.spyOn(service as any, 'getRegisteredMigrations').mockReturnValue([m]);
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.rollbackByName('mig-001')).rejects.toThrow(
        'Cannot roll back migration mig-001',
      );
    });

    it('rolls back when migration is applied and no later migrations exist', async () => {
      const m = makeMigration({ name: 'mig-001' });
      jest.spyOn(service as any, 'getRegisteredMigrations').mockReturnValue([m]);

      const record = Object.assign(new Migration(), {
        name: 'mig-001',
        status: MigrationStatus.COMPLETED,
        appliedAt: new Date('2024-01-01'),
      });
      mockRepo.findOne.mockResolvedValueOnce(record).mockResolvedValueOnce(record);
      mockRepo.find.mockResolvedValue([]);
      mockRepo.save.mockResolvedValue(record);

      await service.rollbackByName('mig-001');

      expect(m.down).toHaveBeenCalled();
    });
  });

  describe('rollbackToVersion', () => {
    it('throws when target migration is not in registry', async () => {
      jest.spyOn(service as any, 'getRegisteredMigrations').mockReturnValue([]);

      await expect(service.rollbackToVersion('unknown')).rejects.toThrow(
        'Target migration not found in registry: unknown',
      );
    });
  });
});
