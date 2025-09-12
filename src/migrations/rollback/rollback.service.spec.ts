import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { RollbackService } from './rollback.service';
import {
  Migration,
  MigrationStatus,
  MigrationType,
} from '../entities/migration.entity';

describe('RollbackService', () => {
  let service: RollbackService;
  let migrationRepository: Repository<Migration>;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  const mockMigration = {
    id: '1',
    version: '1.0.0',
    name: 'test-migration',
    description: 'Test migration',
    type: MigrationType.SCHEMA,
    status: MigrationStatus.COMPLETED,
    environment: 'test',
    filePath: '/test/path',
    upSql: 'CREATE TABLE test (id INT);',
    downSql: 'DROP TABLE test;',
    dependencies: [],
    metadata: {},
    checksum: 'test-checksum',
    executedBy: 'test-user',
    executionTime: 1000,
    error: null,
    rollbackVersion: null,
    conflictResolution: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    timestamp: new Date(),
    executedAt: new Date(),
    rolledBackAt: null,
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RollbackService,
        {
          provide: getRepositoryToken(Migration),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<RollbackService>(RollbackService);
    migrationRepository = module.get<Repository<Migration>>(
      getRepositoryToken(Migration),
    );
    dataSource = module.get<DataSource>(DataSource);
    queryRunner = mockQueryRunner as any;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('rollbackMigration', () => {
    it('should rollback migration successfully', async () => {
      jest
        .spyOn(migrationRepository, 'findOne')
        .mockResolvedValue(mockMigration as Migration);
      jest.spyOn(migrationRepository, 'save').mockResolvedValue({
        ...mockMigration,
        status: MigrationStatus.ROLLED_BACK,
        rolledBackAt: new Date(),
      } as Migration);
      jest.spyOn(queryRunner, 'query').mockResolvedValue([]);

      await service.rollbackMigration('1.0.0', 'test');

      expect(migrationRepository.findOne).toHaveBeenCalledWith({
        where: { version: '1.0.0', environment: 'test' },
      });
      expect(queryRunner.query).toHaveBeenCalledWith(mockMigration.downSql);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw error if migration not found', async () => {
      jest.spyOn(migrationRepository, 'findOne').mockResolvedValue(null);

      await expect(service.rollbackMigration('1.0.0', 'test')).rejects.toThrow(
        'Migration 1.0.0 not found for environment: test',
      );
    });

    it('should throw error if migration is not completed', async () => {
      const pendingMigration = {
        ...mockMigration,
        status: MigrationStatus.PENDING,
      };
      jest
        .spyOn(migrationRepository, 'findOne')
        .mockResolvedValue(pendingMigration as Migration);

      await expect(service.rollbackMigration('1.0.0', 'test')).rejects.toThrow(
        'Cannot rollback migration 1.0.0 because it is not completed',
      );
    });

    it('should handle rollback execution failure', async () => {
      const error = new Error('Rollback SQL failed');
      jest
        .spyOn(migrationRepository, 'findOne')
        .mockResolvedValue(mockMigration as Migration);
      jest.spyOn(queryRunner, 'query').mockRejectedValue(error);

      await expect(service.rollbackMigration('1.0.0', 'test')).rejects.toThrow(
        'Rollback SQL failed',
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('rollbackAllMigrations', () => {
    it('should rollback all migrations successfully', async () => {
      const migrations = [
        { ...mockMigration, version: '2.0.0' },
        { ...mockMigration, version: '1.0.0' },
      ];
      jest
        .spyOn(migrationRepository, 'find')
        .mockResolvedValue(migrations as Migration[]);
      jest.spyOn(service, 'rollbackMigration').mockResolvedValue();

      await service.rollbackAllMigrations('test');

      expect(migrationRepository.find).toHaveBeenCalledWith({
        where: {
          environment: 'test',
          status: MigrationStatus.COMPLETED,
        },
        order: { version: 'DESC' },
      });
      expect(service.rollbackMigration).toHaveBeenCalledTimes(2);
      expect(service.rollbackMigration).toHaveBeenCalledWith('2.0.0', 'test');
      expect(service.rollbackMigration).toHaveBeenCalledWith('1.0.0', 'test');
    });
  });

  describe('rollbackToVersion', () => {
    it('should rollback to specific version successfully', async () => {
      const targetMigration = { ...mockMigration, version: '1.0.0' };
      const migrationsToRollback = [
        { ...mockMigration, version: '3.0.0' },
        { ...mockMigration, version: '2.0.0' },
      ];

      jest
        .spyOn(migrationRepository, 'findOne')
        .mockResolvedValue(targetMigration as Migration);
      jest
        .spyOn(migrationRepository, 'find')
        .mockResolvedValue([
          ...migrationsToRollback,
          targetMigration,
        ] as Migration[]);
      jest.spyOn(service, 'rollbackMigration').mockResolvedValue();

      await service.rollbackToVersion('1.0.0', 'test');

      expect(service.rollbackMigration).toHaveBeenCalledTimes(2);
      expect(service.rollbackMigration).toHaveBeenCalledWith('3.0.0', 'test');
      expect(service.rollbackMigration).toHaveBeenCalledWith('2.0.0', 'test');
    });

    it('should throw error if target version not found', async () => {
      jest.spyOn(migrationRepository, 'findOne').mockResolvedValue(null);

      await expect(service.rollbackToVersion('1.0.0', 'test')).rejects.toThrow(
        'Target migration version 1.0.0 not found',
      );
    });
  });

  describe('validateRollbackSafety', () => {
    it('should validate rollback safety successfully', async () => {
      jest
        .spyOn(migrationRepository, 'findOne')
        .mockResolvedValue(mockMigration as Migration);
      jest.spyOn(migrationRepository, 'find').mockResolvedValue([]);

      const result = await service.validateRollbackSafety('1.0.0', 'test');

      expect(result).toBe(true);
    });

    it('should return false if migration not found', async () => {
      jest.spyOn(migrationRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.validateRollbackSafety('1.0.0', 'test'),
      ).rejects.toThrow('Migration 1.0.0 not found');
    });

    it('should return false if no rollback SQL', async () => {
      const migrationWithoutDownSql = { ...mockMigration, downSql: '' };
      jest
        .spyOn(migrationRepository, 'findOne')
        .mockResolvedValue(migrationWithoutDownSql as Migration);

      const result = await service.validateRollbackSafety('1.0.0', 'test');

      expect(result).toBe(false);
    });

    it('should return false if has dependent migrations', async () => {
      const dependentMigration = {
        ...mockMigration,
        version: '2.0.0',
        dependencies: ['1.0.0'],
      };
      jest
        .spyOn(migrationRepository, 'findOne')
        .mockResolvedValue(mockMigration as Migration);
      jest
        .spyOn(migrationRepository, 'find')
        .mockResolvedValue([dependentMigration] as Migration[]);

      const result = await service.validateRollbackSafety('1.0.0', 'test');

      expect(result).toBe(false);
    });
  });

  describe('createRollbackPlan', () => {
    it('should create rollback plan successfully', async () => {
      const migrations = [
        { ...mockMigration, version: '3.0.0' },
        { ...mockMigration, version: '2.0.0' },
        { ...mockMigration, version: '1.0.0' },
      ];
      jest
        .spyOn(migrationRepository, 'find')
        .mockResolvedValue(migrations as Migration[]);

      const result = await service.createRollbackPlan('1.0.0', 'test');

      expect(result).toHaveLength(2);
      expect(result[0].version).toBe('3.0.0');
      expect(result[1].version).toBe('2.0.0');
    });
  });

  describe('performSafeRollback', () => {
    it('should perform safe rollback successfully', async () => {
      jest.spyOn(service, 'validateRollbackSafety').mockResolvedValue(true);
      jest.spyOn(service, 'rollbackMigration').mockResolvedValue();
      jest.spyOn(service as any, 'createDataBackup').mockResolvedValue();
      jest.spyOn(service as any, 'validateDataIntegrity').mockResolvedValue();

      await service.performSafeRollback('1.0.0', 'test', {
        createBackup: true,
        validateData: true,
      });

      expect(service.validateRollbackSafety).toHaveBeenCalledWith(
        '1.0.0',
        'test',
      );
      expect(service.rollbackMigration).toHaveBeenCalledWith('1.0.0', 'test');
    });

    it('should throw error if rollback is not safe', async () => {
      jest.spyOn(service, 'validateRollbackSafety').mockResolvedValue(false);

      await expect(
        service.performSafeRollback('1.0.0', 'test'),
      ).rejects.toThrow('Rollback of migration 1.0.0 is not safe');
    });
  });
});
