import { BadRequestException } from '@nestjs/common';
import { SchemaValidationService } from './schema-validation.service';
import { IMigrationConfig } from '../migration.service';

const makeMigration = (name = 'test-migration'): IMigrationConfig => ({
  name,
  version: '1.0.0',
  dependencies: [],
  up: jest.fn(),
  down: jest.fn(),
});

describe('SchemaValidationService', () => {
  let service: SchemaValidationService;

  beforeEach(() => {
    service = new SchemaValidationService();
  });

  afterEach(() => jest.clearAllMocks());

  describe('validateBeforeMigration', () => {
    it('returns true for a valid migration', async () => {
      const result = await service.validateBeforeMigration(makeMigration());
      expect(result).toBe(true);
    });

    it('throws BadRequestException when pre-validation fails', async () => {
      jest.spyOn(service as any, 'performPreMigrationValidation').mockResolvedValue(false);

      await expect(service.validateBeforeMigration(makeMigration())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateAfterMigration', () => {
    it('returns true for a valid migration', async () => {
      const result = await service.validateAfterMigration(makeMigration());
      expect(result).toBe(true);
    });

    it('throws BadRequestException when post-validation fails', async () => {
      jest.spyOn(service as any, 'performPostMigrationValidation').mockResolvedValue(false);

      await expect(service.validateAfterMigration(makeMigration())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateCurrentSchema', () => {
    it('returns true', async () => {
      expect(await service.validateCurrentSchema()).toBe(true);
    });
  });

  describe('checkForBreakingChanges', () => {
    it('returns an empty array', async () => {
      const result = await service.checkForBreakingChanges(makeMigration());
      expect(result).toEqual([]);
    });
  });

  describe('validateMigrationDependencies', () => {
    it('returns true when there are no dependencies', async () => {
      const result = await service.validateMigrationDependencies(makeMigration(), []);
      expect(result).toBe(true);
    });

    it('returns true when all dependencies are satisfied', async () => {
      const migration = makeMigration();
      migration.dependencies = ['dep-001', 'dep-002'];

      const result = await service.validateMigrationDependencies(migration, ['dep-001', 'dep-002']);
      expect(result).toBe(true);
    });

    it('returns false when a dependency is missing', async () => {
      const migration = makeMigration();
      migration.dependencies = ['dep-001', 'dep-002'];

      const result = await service.validateMigrationDependencies(migration, ['dep-001']);
      expect(result).toBe(false);
    });
  });

  describe('backupSchemaBeforeMigration', () => {
    it('returns a non-null backup identifier', async () => {
      const result = await service.backupSchemaBeforeMigration(makeMigration('mig-001'));
      expect(result).toMatch(/backup_mig-001/);
    });
  });
});
