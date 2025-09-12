import { Test, TestingModule } from '@nestjs/testing';
import { SchemaValidationService } from './schema-validation.service';
import { Migration, MigrationType } from '../entities/migration.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SchemaSnapshot } from '../entities/schema-snapshot.entity';

jest.mock('typeorm', () => ({
  ...(jest.requireActual('typeorm') as {}),
  DataSource: jest.fn().mockImplementation(() => ({
    createEntityManager: jest.fn(() => ({
      find: jest.fn(),
    })),
    createQueryRunner: jest.fn(),
  })),
}));

describe('SchemaValidationService', () => {
  let service: SchemaValidationService;
  let snapshotRepository: Repository<SchemaSnapshot>;
  let dataSource: DataSource;

  const mockMigration: Migration = {
    id: '1',
    version: '1.0.0',
    name: 'test-migration',
    description: 'Test migration',
    type: MigrationType.SCHEMA,
    status: 'pending',
    environment: 'test',
    filePath: '/test/path',
    upSql: 'CREATE TABLE test (id INT);',
    downSql: 'DROP TABLE test;',
    dependencies: [],
    metadata: {},
    checksum: 'test-checksum',
    executedBy: 'test-user',
    executionTime: 100,
    error: null,
    rollbackVersion: null,
    conflictResolution: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    timestamp: new Date(),
    executedAt: null,
    rolledBackAt: null,
  };

  const mockSnapshot = {
    id: '1',
    version: '1.0.0',
    environment: 'test',
    schema: {},
    tables: [],
    views: [],
    procedures: [],
    functions: [],
    checksum: 'test-checksum',
    createdBy: 'test-user',
    createdAt: new Date(),
    timestamp: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchemaValidationService,
        {
          provide: getRepositoryToken(SchemaSnapshot),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useClass: DataSource,
        },
      ],
    }).compile();

    service = module.get<SchemaValidationService>(SchemaValidationService);
    snapshotRepository = module.get<Repository<SchemaSnapshot>>(
      getRepositoryToken(SchemaSnapshot),
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateMigration', () => {
    it('should validate migration successfully', async () => {
      const result = await service.validateMigration(mockMigration);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContain(
        'Migration contains 0 potential breaking changes',
      );
    });

    it('should detect DROP TABLE in migration', async () => {
      const migrationWithDrop = { ...mockMigration, upSql: 'DROP TABLE test;' };

      await expect(
        service.validateMigration(migrationWithDrop),
      ).rejects.toThrow(
        'Migration validation failed: No DROP TABLE: Dropping tables is not allowed',
      );
    });
  });

  describe('validateSchemaCompatibility', () => {
    it('should validate schema compatibility successfully', async () => {
      const result = await service.validateSchemaCompatibility(
        mockSnapshot.schema,
        mockSnapshot.schema,
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect removed table as breaking change', async () => {
      const currentSchema = { tables: [{ name: 'table1' }] };
      const newSchema = { tables: [] };

      const result = await service.validateSchemaCompatibility(
        currentSchema,
        newSchema,
      );

      expect(result.breakingChanges).toContain('Removed tables: table1');
    });
  });

  describe('validateDataIntegrity', () => {
    it('should validate data integrity successfully', async () => {
      const result = await service.validateDataIntegrity(mockMigration);
      expect(result).toBe(true);
    });
  });
});
