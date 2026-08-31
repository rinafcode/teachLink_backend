import { EventEmitter2 } from '@nestjs/event-emitter';
import { ABTestingService } from './ab-testing.service';
import { Experiment, ExperimentType } from './entities/experiment.entity';
import { IExperimentVariant } from './entities/experiment-variant.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ABTestingService', () => {
  const makeDto = (variantCount = 2) => ({
    name: 'Test Experiment',
    description: 'desc',
    type: ExperimentType.A_B_TEST,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-02-01'),
    trafficAllocation: 100,
    autoAllocateTraffic: false,
    autoStopOnSignificance: false,
    significanceThreshold: 0.95,
    confidenceLevel: 0.95,
    minimumSampleSize: 100,
    hypothesis: 'h',
    variants: Array.from({ length: variantCount }, (_, index) => ({
      name: `Variant ${index}`,
      description: `Variant ${index}`,
      configuration: {},
      isControl: index === 0,
    })),
    metrics: [],
  });

  it('persists all variants through a single transaction and one bulk save', async () => {
    const experimentRepo = {
      save: jest.fn().mockResolvedValue({ id: 'experiment-1', name: 'Test Experiment' }),
    };
    const variantRepo = {
      save: jest.fn().mockResolvedValue([]),
    };
    const transaction = jest.fn(async (callback: (manager: any) => Promise<unknown>) =>
      callback({
        getRepository: (entity: unknown) => (entity === Experiment ? experimentRepo : variantRepo),
      }),
    );
    const dataSource = { transaction } as any;
    const service = new ABTestingService(
      experimentRepo as any,
      variantRepo as any,
      new EventEmitter2(),
      dataSource,
    );

    await service.createExperiment(makeDto(3));

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(experimentRepo.save).toHaveBeenCalledTimes(1);
    expect(variantRepo.save).toHaveBeenCalledTimes(1);
    expect(Array.isArray(variantRepo.save.mock.calls[0][0])).toBe(true);
    expect(variantRepo.save.mock.calls[0][0]).toHaveLength(3);
  });

  it('surfaces failures without committing partial variant state', async () => {
    const experimentRepo = {
      save: jest.fn().mockResolvedValue({ id: 'experiment-1', name: 'Test Experiment' }),
    };
    const variantRepo = {
      save: jest.fn().mockRejectedValue(new Error('variant save failed')),
    };
    const transaction = jest.fn(async (callback: (manager: any) => Promise<unknown>) =>
      callback({
        getRepository: (entity: unknown) => (entity === Experiment ? experimentRepo : variantRepo),
      }),
    );
    const dataSource = { transaction } as any;
    const service = new ABTestingService(
      experimentRepo as any,
      variantRepo as any,
      new EventEmitter2(),
      dataSource,
    );

    await expect(service.createExperiment(makeDto(2))).rejects.toThrow('variant save failed');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(experimentRepo.save).toHaveBeenCalledTimes(1);
    expect(variantRepo.save).toHaveBeenCalledTimes(1);
  });

  // ============================================================================
  // Pagination Tests for getAllExperiments()
  // ============================================================================

  describe('getAllExperiments - Pagination', () => {
    const mockExperiments = Array.from({ length: 25 }, (_, i) => ({
      id: `exp-${i}`,
      name: `Experiment ${i}`,
      status: 'running',
      createdAt: new Date(Date.now() - (25 - i) * 1000),
      updatedAt: new Date(),
    }));

    it('should return default paginated response when no query params provided', async () => {
      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockExperiments.slice(0, 10), 25]),
      };

      const experimentRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      const service = new ABTestingService(
        experimentRepo as any,
        {} as any,
        new EventEmitter2(),
        {} as any,
      );

      const result = await service.getAllExperiments();

      expect(result.data).toHaveLength(10);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(false);
    });

    it('should apply correct skip and take for pagination', async () => {
      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockExperiments.slice(10, 20), 25]),
      };

      const experimentRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      const service = new ABTestingService(
        experimentRepo as any,
        {} as any,
        new EventEmitter2(),
        {} as any,
      );

      await service.getAllExperiments({ page: 2, limit: 10 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should apply sorting by specified field', async () => {
      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockExperiments, 25]),
      };

      const experimentRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      const service = new ABTestingService(
        experimentRepo as any,
        {} as any,
        new EventEmitter2(),
        {} as any,
      );

      await service.getAllExperiments({ sortBy: 'name', order: 'ASC' });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('experiment.name', 'ASC');
    });

    it('should reject invalid sortBy field to prevent SQL injection', async () => {
      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockExperiments, 25]),
      };

      const experimentRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      const service = new ABTestingService(
        experimentRepo as any,
        {} as any,
        new EventEmitter2(),
        {} as any,
      );

      await expect(
        service.getAllExperiments({ sortBy: 'malicious_field' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate pagination metadata correctly', async () => {
      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockExperiments.slice(15, 20), 27]),
      };

      const experimentRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      const service = new ABTestingService(
        experimentRepo as any,
        {} as any,
        new EventEmitter2(),
        {} as any,
      );

      const result = await service.getAllExperiments({ page: 2, limit: 5 });

      expect(result.total).toBe(27);
      expect(result.totalPages).toBe(6); // ceil(27 / 5) = 6
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(true);
    });

    it('should not load relations (variants/metrics) for list view', async () => {
      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockExperiments.slice(0, 10), 25]),
      };

      const experimentRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      const service = new ABTestingService(
        experimentRepo as any,
        {} as any,
        new EventEmitter2(),
        {} as any,
      );

      await service.getAllExperiments();

      // Verify that createQueryBuilder was called but no leftJoinAndSelect for relations
      expect(experimentRepo.createQueryBuilder).toHaveBeenCalledWith('experiment');
      // Verify no relations were added
      expect(mockQueryBuilder.orderBy).toHaveBeenCalled();
    });

    it('should handle page size clamping at maximum', async () => {
      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockExperiments.slice(0, 10), 25]),
      };

      const experimentRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      const service = new ABTestingService(
        experimentRepo as any,
        {} as any,
        new EventEmitter2(),
        {} as any,
      );

      // Request a very large limit that exceeds MAX_PAGE_SIZE (100)
      await service.getAllExperiments({ page: 1, limit: 500 });

      // Should be clamped to MAX_PAGE_SIZE
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(100);
    });

    it('should handle last page correctly', async () => {
      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockExperiments.slice(20, 25), 25]),
      };

      const experimentRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      const service = new ABTestingService(
        experimentRepo as any,
        {} as any,
        new EventEmitter2(),
        {} as any,
      );

      const result = await service.getAllExperiments({ page: 3, limit: 10 });

      expect(result.data).toHaveLength(5);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPrevPage).toBe(true);
    });
  });
});
