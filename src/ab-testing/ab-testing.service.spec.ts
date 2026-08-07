import { EventEmitter2 } from '@nestjs/event-emitter';
import { ABTestingService } from './ab-testing.service';
import { Experiment, ExperimentType } from './entities/experiment.entity';
import { IExperimentVariant } from './entities/experiment-variant.entity';

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
});
