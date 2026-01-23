import { Test, TestingModule } from '@nestjs/testing';
import { ConflictResolutionService, ConflictResolutionStrategy, SyncData } from './conflict-resolution.service';

describe('ConflictResolutionService', () => {
  let service: ConflictResolutionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConflictResolutionService],
    }).compile();

    service = module.get<ConflictResolutionService>(ConflictResolutionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolve', () => {
    const localData: SyncData = {
      id: '1',
      version: 2,
      lastModified: new Date('2023-01-01T10:00:00Z'),
      data: { name: 'Local' },
    };

    const remoteData: SyncData = {
      id: '1',
      version: 3,
      lastModified: new Date('2023-01-01T11:00:00Z'),
      data: { name: 'Remote' },
    };

    it('should resolve using LAST_WRITE_WINS (remote wins)', () => {
      const result = service.resolve(localData, remoteData, ConflictResolutionStrategy.LAST_WRITE_WINS);
      expect(result.data.name).toBe('Remote');
    });

    it('should resolve using LAST_WRITE_WINS (local wins)', () => {
      const olderRemote = { ...remoteData, lastModified: new Date('2023-01-01T09:00:00Z') };
      const result = service.resolve(localData, olderRemote, ConflictResolutionStrategy.LAST_WRITE_WINS);
      expect(result.data.name).toBe('Local');
    });

    it('should resolve using VERSIONING', () => {
      const result = service.resolve(localData, remoteData, ConflictResolutionStrategy.VERSIONING);
      expect(result.data.name).toBe('Remote');
    });

    it('should resolve using MANUAL_MERGE', () => {
      const result = service.resolve(localData, remoteData, ConflictResolutionStrategy.MANUAL_MERGE);
      expect(result.data._conflict.status).toBe('needs_merge');
    });
  });
});
