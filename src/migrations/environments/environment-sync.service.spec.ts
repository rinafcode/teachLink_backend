import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvironmentSyncService } from './environment-sync.service';
import { SchemaSnapshot } from '../entities/schema-snapshot.entity';

describe('EnvironmentSyncService', () => {
  let service: EnvironmentSyncService;
  let snapshotRepository: Repository<SchemaSnapshot>;

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
        EnvironmentSyncService,
        {
          provide: getRepositoryToken(SchemaSnapshot),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EnvironmentSyncService>(EnvironmentSyncService);
    snapshotRepository = module.get<Repository<SchemaSnapshot>>(
      getRepositoryToken(SchemaSnapshot),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('synchronizeSchema', () => {
    it('should synchronize schema successfully', async () => {
      jest
        .spyOn(snapshotRepository, 'findOne')
        .mockResolvedValue(mockSnapshot as SchemaSnapshot);
      jest
        .spyOn(snapshotRepository, 'save')
        .mockResolvedValue(mockSnapshot as SchemaSnapshot);

      await service.synchronizeSchema('sourceEnv', 'targetEnv');

      expect(snapshotRepository.findOne).toHaveBeenCalledWith({
        where: { environment: 'sourceEnv' },
        order: { timestamp: 'DESC' },
      });
    });

    it('should throw error if source snapshot not found', async () => {
      jest.spyOn(snapshotRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.synchronizeSchema('sourceEnv', 'targetEnv'),
      ).rejects.toThrow(
        'No schema snapshot found for source environment: sourceEnv',
      );
    });
  });

  describe('validateSynchronization', () => {
    it('should validate synchronization successfully', async () => {
      jest
        .spyOn(snapshotRepository, 'findOne')
        .mockResolvedValue(mockSnapshot as SchemaSnapshot);

      const result = await service.validateSynchronization(
        'sourceEnv',
        'targetEnv',
      );

      expect(result).toBe(true);
    });

    it('should return false if checksums differ', async () => {
      const differentSnapshot = {
        ...mockSnapshot,
        checksum: 'different-checksum',
      };
      jest
        .spyOn(snapshotRepository, 'findOne')
        .mockResolvedValueOnce(mockSnapshot as SchemaSnapshot);
      jest
        .spyOn(snapshotRepository, 'findOne')
        .mockResolvedValueOnce(differentSnapshot as SchemaSnapshot);

      const result = await service.validateSynchronization(
        'sourceEnv',
        'targetEnv',
      );

      expect(result).toBe(false);
    });
  });
});
