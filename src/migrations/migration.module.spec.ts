import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MigrationModule } from './migration.module';
import { MigrationService } from './migration.service';
import { RollbackService } from './rollback/rollback.service';
import { SchemaValidationService } from './validation/schema-validation.service';
import { EnvironmentSyncService } from './environments/environment-sync.service';
import { ConflictResolutionService } from './conflicts/conflict-resolution.service';
import { Migration } from './entities/migration.entity';
import { SchemaSnapshot } from './entities/schema-snapshot.entity';

describe('MigrationModule Integration', () => {
  let module: TestingModule;
  let migrationService: MigrationService;
  let rollbackService: RollbackService;
  let schemaValidationService: SchemaValidationService;
  let environmentSyncService: EnvironmentSyncService;
  let conflictResolutionService: ConflictResolutionService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [MigrationModule],
    })
      .overrideProvider(getRepositoryToken(Migration))
      .useValue({
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(SchemaSnapshot))
      .useValue({
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
      })
      .overrideProvider(DataSource)
      .useValue({
        createQueryRunner: jest.fn(() => ({
          connect: jest.fn(),
          startTransaction: jest.fn(),
          commitTransaction: jest.fn(),
          rollbackTransaction: jest.fn(),
          release: jest.fn(),
          query: jest.fn(),
        })),
      })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn(),
      })
      .compile();

    migrationService = module.get<MigrationService>(MigrationService);
    rollbackService = module.get<RollbackService>(RollbackService);
    schemaValidationService = module.get<SchemaValidationService>(
      SchemaValidationService,
    );
    environmentSyncService = module.get<EnvironmentSyncService>(
      EnvironmentSyncService,
    );
    conflictResolutionService = module.get<ConflictResolutionService>(
      ConflictResolutionService,
    );
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Module Initialization', () => {
    it('should be defined', () => {
      expect(module).toBeDefined();
    });

    it('should have all services defined', () => {
      expect(migrationService).toBeDefined();
      expect(rollbackService).toBeDefined();
      expect(schemaValidationService).toBeDefined();
      expect(environmentSyncService).toBeDefined();
      expect(conflictResolutionService).toBeDefined();
    });
  });

  describe('Service Dependencies', () => {
    it('should inject dependencies correctly', () => {
      // Verify that services are instances of their respective classes
      expect(migrationService).toBeInstanceOf(MigrationService);
      expect(rollbackService).toBeInstanceOf(RollbackService);
      expect(schemaValidationService).toBeInstanceOf(SchemaValidationService);
      expect(environmentSyncService).toBeInstanceOf(EnvironmentSyncService);
      expect(conflictResolutionService).toBeInstanceOf(
        ConflictResolutionService,
      );
    });
  });

  describe('Module Exports', () => {
    it('should export all services', () => {
      const exports = module.get(MigrationService);
      expect(exports).toBeDefined();
    });
  });

  describe('Complete Migration Workflow Integration', () => {
    it('should handle end-to-end migration workflow', async () => {
      // This test would simulate a complete migration workflow
      // including validation, execution, and rollback capabilities

      const mockMigrationData = {
        version: '1.0.0',
        name: 'test-migration',
        description: 'Integration test migration',
        type: 'schema' as any,
        upSql: 'CREATE TABLE integration_test (id INT);',
        downSql: 'DROP TABLE integration_test;',
        dependencies: [],
        metadata: {},
      };

      // Mock the repository methods for this integration test
      const migrationRepo = module.get(getRepositoryToken(Migration));
      const snapshotRepo = module.get(getRepositoryToken(SchemaSnapshot));

      jest.spyOn(migrationRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(migrationRepo, 'save').mockResolvedValue({
        ...mockMigrationData,
        id: '1',
        environment: 'test',
      });
      jest.spyOn(migrationRepo, 'find').mockResolvedValue([]);
      jest.spyOn(snapshotRepo, 'findOne').mockResolvedValue(null);

      // Test migration registration
      const registeredMigration = await migrationService.registerMigration(
        mockMigrationData,
        'test',
      );

      expect(registeredMigration).toBeDefined();
      expect(registeredMigration.version).toBe('1.0.0');

      // Test conflict resolution
      await expect(
        conflictResolutionService.checkForConflicts([registeredMigration]),
      ).resolves.not.toThrow();

      // Test schema validation
      const validationResult =
        await schemaValidationService.validateMigration(registeredMigration);
      expect(validationResult).toBeDefined();

      // Test environment sync validation
      const syncResult = await environmentSyncService.validateSynchronization(
        'dev',
        'test',
      );
      expect(typeof syncResult).toBe('boolean');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle service interdependency errors gracefully', async () => {
      // Test error propagation between services
      const migrationRepo = module.get(getRepositoryToken(Migration));
      jest
        .spyOn(migrationRepo, 'findOne')
        .mockRejectedValue(new Error('Database connection failed'));

      await expect(
        migrationService.getMigrationStatus('1.0.0', 'test'),
      ).rejects.toThrow('Database connection failed');
    });
  });
});
