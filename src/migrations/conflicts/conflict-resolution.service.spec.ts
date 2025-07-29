import { Test, TestingModule } from '@nestjs/testing';
import { ConflictResolutionService } from './conflict-resolution.service';
import { Migration, MigrationStatus, MigrationType } from '../entities/migration.entity';

describe('ConflictResolutionService', () => {
  let service: ConflictResolutionService;

  const mockMigration1: Migration = {
    id: '1',
    version: '1.0.0',
    name: 'test-migration-1',
    description: 'Test migration 1',
    type: MigrationType.SCHEMA,
    status: MigrationStatus.PENDING,
    environment: 'test',
    filePath: '/test/path1',
    upSql: 'CREATE TABLE test1 (id INT);',
    downSql: 'DROP TABLE test1;',
    dependencies: [],
    metadata: {},
    checksum: 'test-checksum-1',
    executedBy: null,
    executionTime: null,
    error: null,
    rollbackVersion: null,
    conflictResolution: null,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    timestamp: new Date('2023-01-01'),
    executedAt: null,
    rolledBackAt: null
  };

  const mockMigration2: Migration = {
    id: '2',
    version: '1.0.0',
    name: 'test-migration-2',
    description: 'Test migration 2',
    type: MigrationType.SCHEMA,
    status: MigrationStatus.PENDING,
    environment: 'test',
    filePath: '/test/path2',
    upSql: 'CREATE TABLE test2 (id INT);',
    downSql: 'DROP TABLE test2;',
    dependencies: [],
    metadata: {},
    checksum: 'test-checksum-2',
    executedBy: null,
    executionTime: null,
    error: null,
    rollbackVersion: null,
    conflictResolution: null,
    createdAt: new Date('2023-01-02'),
    updatedAt: new Date('2023-01-02'),
    timestamp: new Date('2023-01-02'),
    executedAt: null,
    rolledBackAt: null
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConflictResolutionService],
    }).compile();

    service = module.get<ConflictResolutionService>(ConflictResolutionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkForConflicts', () => {
    it('should pass when no conflicts exist', async () => {
      const migrations = [
        { ...mockMigration1, version: '1.0.0' },
        { ...mockMigration2, version: '2.0.0' }
      ];

      await expect(service.checkForConflicts(migrations)).resolves.not.toThrow();
    });

    it('should throw error when conflicts exist', async () => {
      const migrations = [mockMigration1, mockMigration2]; // Both have same version '1.0.0'

      await expect(service.checkForConflicts(migrations))
        .rejects.toThrow('Conflict detected for version test_1.0.0');
    });

    it('should handle empty migrations array', async () => {
      await expect(service.checkForConflicts([])).resolves.not.toThrow();
    });
  });

  describe('resolveConflicts', () => {
    it('should resolve conflicts by keeping latest migration', async () => {
      const migrations = [mockMigration1, mockMigration2]; // Both have same version

      const resolved = await service.resolveConflicts(migrations);

      expect(resolved).toHaveLength(1);
      expect(resolved[0].id).toBe('2'); // Migration 2 has later timestamp
    });

    it('should handle migrations with different versions', async () => {
      const migrations = [
        { ...mockMigration1, version: '1.0.0' },
        { ...mockMigration2, version: '2.0.0' }
      ];

      const resolved = await service.resolveConflicts(migrations);

      expect(resolved).toHaveLength(2);
    });

    it('should handle empty migrations array', async () => {
      const resolved = await service.resolveConflicts([]);

      expect(resolved).toHaveLength(0);
    });
  });

  describe('suggestConflictResolutionStrategies', () => {
    it('should return conflict resolution strategies', async () => {
      const strategies = await service.suggestConflictResolutionStrategies();

      expect(strategies).toHaveLength(3);
      expect(strategies[0]).toContain('Manual review');
      expect(strategies[1]).toContain('schema snapshots');
      expect(strategies[2]).toContain('custom scripts');
    });
  });
});
