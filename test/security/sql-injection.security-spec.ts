import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransactionHelperService } from '../../src/common/database/transaction-helper.service';
import { ShardMigrationService } from '../../src/sharding/migration/shard-migration.service';
import { ShardConfigService } from '../../src/sharding/shard-config.service';
import { ShardConnectionManager } from '../../src/sharding/connection/shard-connection-manager.service';
import { TenantAdminService } from '../../src/tenancy/admin/tenant-admin.service';
import { Tenant } from '../../src/tenancy/entities/tenant.entity';
import { TenantConfig } from '../../src/tenancy/entities/tenant-config.entity';
import { TenantBilling } from '../../src/tenancy/entities/tenant-billing.entity';
import { TenantCustomization } from '../../src/tenancy/entities/tenant-customization.entity';
import { SearchService } from '../../src/search/search.service';
import { Course } from '../../src/courses/entities/course.entity';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('SQL Injection Prevention Security Tests', () => {
  // 1. TransactionHelperService Tests
  describe('TransactionHelperService Savepoint & Timeout Validation', () => {
    let transactionHelper: TransactionHelperService;
    let mockManager: any;

    beforeEach(async () => {
      mockManager = {
        query: jest.fn().mockResolvedValue([]),
        queryRunner: {
          isTransactionActive: true,
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TransactionHelperService,
          {
            provide: DataSource,
            useValue: {
              createQueryRunner: () => ({
                connect: jest.fn(),
                startTransaction: jest.fn(),
                commitTransaction: jest.fn(),
                rollbackTransaction: jest.fn(),
                release: jest.fn(),
                manager: mockManager,
              }),
            },
          },
        ],
      }).compile();

      transactionHelper = module.get<TransactionHelperService>(TransactionHelperService);
    });

    it('should allow valid savepoint names', async () => {
      const validNames = ['sp1', 'savepoint_1', '_sp_test_99'];
      for (const name of validNames) {
        await expect(transactionHelper.createSavepoint(mockManager, name)).resolves.not.toThrow();
        expect(mockManager.query).toHaveBeenLastCalledWith(`SAVEPOINT ${name}`);
      }
    });

    it('should reject invalid savepoint names containing SQL injection payloads', async () => {
      const injectionPayloads = [
        'sp1; DROP TABLE users;--',
        'sp1 OR 1=1',
        'sp1 union select null',
        'sp-1',
        'sp 1',
        'sp1"',
        "sp1'",
        'sp1\\',
      ];

      for (const payload of injectionPayloads) {
        await expect(transactionHelper.createSavepoint(mockManager, payload)).rejects.toThrow(
          /Invalid savepoint name/,
        );
        await expect(transactionHelper.rollbackToSavepoint(mockManager, payload)).rejects.toThrow(
          /Invalid savepoint name/,
        );
        await expect(transactionHelper.releaseSavepoint(mockManager, payload)).rejects.toThrow(
          /Invalid savepoint name/,
        );
      }
    });

    it('should reject invalid transaction lock timeouts', async () => {
      const invalidTimeouts = [-1, 1.5, NaN, Infinity, -100];
      for (const timeout of invalidTimeouts) {
        await expect(transactionHelper.setTransactionTimeout(mockManager, timeout)).rejects.toThrow(
          /Invalid timeout value/,
        );
      }
    });

    it('should allow valid transaction lock timeouts', async () => {
      await expect(transactionHelper.setTransactionTimeout(mockManager, 1000)).resolves.not.toThrow();
      expect(mockManager.query).toHaveBeenCalledWith('SET LOCK_TIMEOUT 1000');
    });
  });

  // 2. ShardMigrationService Tests
  describe('ShardMigrationService Identifier Validation', () => {
    let migrationService: ShardMigrationService;
    let mockShardConfigService: any;
    let mockConnectionManager: any;

    beforeEach(async () => {
      mockShardConfigService = {
        getShardById: jest.fn().mockReturnValue({ id: 'shard1', status: 'active' }),
        updateShardStatus: jest.fn(),
      };
      mockConnectionManager = {
        getConnection: jest.fn().mockResolvedValue({
          query: jest.fn().mockResolvedValue([]),
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ShardMigrationService,
          { provide: ShardConfigService, useValue: mockShardConfigService },
          { provide: ShardConnectionManager, useValue: mockConnectionManager },
        ],
      }).compile();

      migrationService = module.get<ShardMigrationService>(ShardMigrationService);
    });

    it('should reject table names containing SQL injection payloads', async () => {
      const badPlan = {
        id: 'plan-1',
        sourceShardId: 'shard1',
        targetShardId: 'shard2',
        entityType: 'users; DROP TABLE courses;--',
        batchSize: 100,
        dryRun: false,
        status: 'pending' as const,
        migratedRows: 0,
        totalRows: 0,
        createdAt: new Date(),
        estimatedRowCount: 100,
      };

      await expect(migrationService.startMigration(badPlan)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject column names containing SQL injection payloads during bulk insert', async () => {
      // Accessing internal private method for robust coverage
      const targetDs = {
        query: jest.fn().mockResolvedValue([]),
      } as any;

      const badRows = [
        {
          id: '1',
          'name"; DROP TABLE users;--': 'test',
        },
      ];

      await expect(
        (migrationService as any).bulkInsert(targetDs, 'courses', badRows),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // 3. QueryBuilder Parameterization Tests
  describe('QueryBuilder Param Validation', () => {
    it('should use parameterized queries in TenantAdminService searchTenants', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      const mockTenantRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TenantAdminService,
          { provide: getRepositoryToken(Tenant), useValue: mockTenantRepo },
          { provide: getRepositoryToken(TenantConfig), useValue: {} },
          { provide: getRepositoryToken(TenantBilling), useValue: {} },
          { provide: getRepositoryToken(TenantCustomization), useValue: {} },
        ],
      }).compile();

      const tenantAdminService = module.get<TenantAdminService>(TenantAdminService);
      const query = "test' OR '1'='1";
      await tenantAdminService.searchTenants(query);

      // Verify template strings don't concatenate raw query directly
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "tenant.name ILIKE :query ESCAPE '\\'",
        expect.objectContaining({ query: expect.stringContaining("test' OR '1'='1") }),
      );
      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        "tenant.slug ILIKE :query ESCAPE '\\'",
        expect.objectContaining({ query: expect.stringContaining("test' OR '1'='1") }),
      );
    });

    it('should use parameterized queries in SearchService course search', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      const mockCourseRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SearchService,
          { provide: getRepositoryToken(Course), useValue: mockCourseRepo },
          { provide: NestElasticsearchService, useValue: {} },
          { provide: CACHE_MANAGER, useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn() } },
        ],
      }).compile();

      const searchService = module.get<SearchService>(SearchService);
      const query = "javascript'; DROP TABLE courses;--";
      await searchService.search(query);

      // Verify SQL template contains placeholders, not the raw query string
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'course.title ILIKE :query OR course.description ILIKE :query',
        expect.objectContaining({ query: expect.stringContaining("javascript'; DROP TABLE courses;--") }),
      );
    });
  });
});
