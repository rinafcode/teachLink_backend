import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MigrationService } from './migration.service';
import { Migration, MigrationStatus, MigrationType } from './entities/migration.entity';
import { SchemaSnapshot } from './entities/schema-snapshot.entity';
import { SchemaValidationService } from './validation/schema-validation.service';
import { ConflictResolutionService } from './conflicts/conflict-resolution.service';

describe('MigrationService', () => {
  let service: MigrationService;
  let migrationRepository: Repository<Migration>;
  let snapshotRepository: Repository<SchemaSnapshot>;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let schemaValidationService: SchemaValidationService;
  let conflictResolutionService: ConflictResolutionService;

  const mockMigration = {
    id: '1',
    version: '1.0.0',
    name: 'test-migration',
    description: 'Test migration',
    type: MigrationType.SCHEMA,
    status: MigrationStatus.PENDING,
    environment: 'test',
    filePath: '/test/path',
    upSql: 'CREATE TABLE test (id INT);',
    downSql: 'DROP TABLE test;',
    dependencies: [],
    metadata: {},
    checksum: 'test-checksum',
    executedBy: null,
    executionTime: null,
    error: null,
    rollbackVersion: null,
    conflictResolution: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    timestamp: new Date(),
    executedAt: null,
    rolledBackAt: null
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn()
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner)
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationService,
        {
          provide: getRepositoryToken(Migration),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
          }
        },
        {
          provide: getRepositoryToken(SchemaSnapshot),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn()
          }
        },
        {
          provide: DataSource,
          useValue: mockDataSource
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn()
          }
        },
        {
          provide: SchemaValidationService,
          useValue: {
            validateMigration: jest.fn()
          }
        },
        {
          provide: ConflictResolutionService,
          useValue: {
            checkForConflicts: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<MigrationService>(MigrationService);
    migrationRepository = module.get<Repository<Migration>>(getRepositoryToken(Migration));
    snapshotRepository = module.get<Repository<SchemaSnapshot>>(getRepositoryToken(SchemaSnapshot));
    dataSource = module.get<DataSource>(DataSource);
    schemaValidationService = module.get<SchemaValidationService>(SchemaValidationService);
    conflictResolutionService = module.get<ConflictResolutionService>(ConflictResolutionService);
    queryRunner = mockQueryRunner as any;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runMigrations', () => {
    it('should run pending migrations successfully', async () => {
      const pendingMigrations = [mockMigration];
      
      jest.spyOn(migrationRepository, 'find').mockResolvedValue(pendingMigrations);
      jest.spyOn(conflictResolutionService, 'checkForConflicts').mockResolvedValue();
      jest.spyOn(schemaValidationService, 'validateMigration').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        breakingChanges: []
      });
      jest.spyOn(migrationRepository, 'save').mockResolvedValue(mockMigration as Migration);
      jest.spyOn(queryRunner, 'query').mockResolvedValue([]);
      jest.spyOn(service as any, 'createSchemaSnapshot').mockResolvedValue(undefined);

      await service.runMigrations('test');

      expect(migrationRepository.find).toHaveBeenCalledWith({
        where: {
          environment: 'test',
          status: MigrationStatus.PENDING
        },
        order: { version: 'ASC' }
      });
      expect(conflictResolutionService.checkForConflicts).toHaveBeenCalledWith(pendingMigrations);
      expect(queryRunner.query).toHaveBeenCalledWith(mockMigration.upSql);
    });

    it('should handle no pending migrations', async () => {
      jest.spyOn(migrationRepository, 'find').mockResolvedValue([]);

      await service.runMigrations('test');

      expect(migrationRepository.find).toHaveBeenCalled();
      expect(conflictResolutionService.checkForConflicts).not.toHaveBeenCalled();
    });

    it('should handle migration execution failure', async () => {
      const pendingMigrations = [mockMigration];
      const error = new Error('SQL execution failed');
      
      jest.spyOn(migrationRepository, 'find').mockResolvedValue(pendingMigrations);
      jest.spyOn(conflictResolutionService, 'checkForConflicts').mockResolvedValue();
      jest.spyOn(schemaValidationService, 'validateMigration').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        breakingChanges: []
      });
      jest.spyOn(migrationRepository, 'save').mockResolvedValue(mockMigration as Migration);
      jest.spyOn(queryRunner, 'query').mockRejectedValue(error);

      await expect(service.runMigrations('test')).rejects.toThrow('SQL execution failed');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('registerMigration', () => {
    const migrationData = {
      version: '1.0.0',
      name: 'test-migration',
      description: 'Test migration',
      type: MigrationType.SCHEMA,
      upSql: 'CREATE TABLE test (id INT);',
      downSql: 'DROP TABLE test;',
      dependencies: [],
      metadata: {}
    };

    it('should register a new migration', async () => {
      jest.spyOn(migrationRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(migrationRepository, 'save').mockResolvedValue(mockMigration as Migration);

      const result = await service.registerMigration(migrationData, 'test');

      expect(migrationRepository.findOne).toHaveBeenCalledWith({
        where: { version: '1.0.0', environment: 'test' }
      });
      expect(migrationRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return existing migration if unchanged', async () => {
      const existingMigration = { ...mockMigration, checksum: 'existing-checksum' };
      jest.spyOn(migrationRepository, 'findOne').mockResolvedValue(existingMigration as Migration);
      jest.spyOn(service as any, 'calculateChecksum').mockReturnValue('existing-checksum');

      const result = await service.registerMigration(migrationData, 'test');

      expect(result).toEqual(existingMigration);
      expect(migrationRepository.save).not.toHaveBeenCalled();
    });

    it('should throw error if migration has been modified', async () => {
      const existingMigration = { ...mockMigration, checksum: 'old-checksum' };
      jest.spyOn(migrationRepository, 'findOne').mockResolvedValue(existingMigration as Migration);
      jest.spyOn(service as any, 'calculateChecksum').mockReturnValue('new-checksum');

      await expect(service.registerMigration(migrationData, 'test'))
        .rejects.toThrow('Migration 1.0.0 has been modified after registration');
    });
  });

  describe('getMigrationHistory', () => {
    it('should return migration history for environment', async () => {
      const migrations = [mockMigration];
      jest.spyOn(migrationRepository, 'find').mockResolvedValue(migrations as Migration[]);

      const result = await service.getMigrationHistory('test');

      expect(migrationRepository.find).toHaveBeenCalledWith({
        where: { environment: 'test' },
        order: { executedAt: 'DESC' }
      });
      expect(result).toEqual(migrations);
    });
  });

  describe('getMigrationStatus', () => {
    it('should return migration status', async () => {
      jest.spyOn(migrationRepository, 'findOne').mockResolvedValue(mockMigration as Migration);

      const result = await service.getMigrationStatus('1.0.0', 'test');

      expect(migrationRepository.findOne).toHaveBeenCalledWith({
        where: { version: '1.0.0', environment: 'test' }
      });
      expect(result).toEqual(mockMigration);
    });

    it('should return null if migration not found', async () => {
      jest.spyOn(migrationRepository, 'findOne').mockResolvedValue(null);

      const result = await service.getMigrationStatus('1.0.0', 'test');

      expect(result).toBeNull();
    });
  });

  describe('validateMigrationIntegrity', () => {
    it('should validate migration integrity successfully', async () => {
      const migrations = [mockMigration];
      jest.spyOn(migrationRepository, 'find').mockResolvedValue(migrations as Migration[]);
      jest.spyOn(service as any, 'calculateChecksum').mockReturnValue(mockMigration.checksum);

      const result = await service.validateMigrationIntegrity();

      expect(result).toBe(true);
    });

    it('should fail validation if checksum mismatch', async () => {
      const migrations = [mockMigration];
      jest.spyOn(migrationRepository, 'find').mockResolvedValue(migrations as Migration[]);
      jest.spyOn(service as any, 'calculateChecksum').mockReturnValue('different-checksum');

      const result = await service.validateMigrationIntegrity();

      expect(result).toBe(false);
    });
  });

  describe('private methods', () => {
    it('should calculate checksum correctly', () => {
      const data = { test: 'data' };
      const checksum = (service as any).calculateChecksum(data);
      
      expect(checksum).toBeDefined();
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBe(64); // SHA256 hash length
    });

    it('should get current user', () => {
      const user = (service as any).getCurrentUser();
      
      expect(user).toBeDefined();
      expect(typeof user).toBe('string');
    });
  });
});
