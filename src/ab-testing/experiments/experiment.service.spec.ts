import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ExperimentService } from './experiment.service';
import { Experiment, ExperimentStatus } from '../entities/experiment.entity';
import { IExperimentVariant } from '../entities/experiment-variant.entity';
import { ExperimentMetric } from '../entities/experiment-metric.entity';
import { VariantMetric } from '../entities/variant-metric.entity';

const makeExperiment = (overrides: Partial<Experiment> = {}): Experiment =>
  ({
    id: 'exp-1',
    name: 'My Experiment',
    status: ExperimentStatus.RUNNING,
    variants: [],
    ...overrides,
  }) as Experiment;

const makeVariant = (overrides: Partial<IExperimentVariant> = {}): IExperimentVariant =>
  ({
    id: 'var-1',
    name: 'Variant A',
    isControl: false,
    isWinner: false,
    trafficAllocation: 0.5,
    metrics: [],
    ...overrides,
  }) as IExperimentVariant;

describe('ExperimentService', () => {
  let service: ExperimentService;
  let experimentRepo: { findOne: jest.Mock; save: jest.Mock };
  let variantRepo: { save: jest.Mock; softDelete: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    experimentRepo = {
      findOne: jest.fn(),
      save: jest.fn((e) => Promise.resolve(e)),
    };
    variantRepo = {
      save: jest.fn((v) => Promise.resolve(v)),
      softDelete: jest.fn(() => Promise.resolve()),
    };
    dataSource = {
      transaction: jest.fn((cb) =>
        cb({ getRepository: () => ({ save: jest.fn((v) => Promise.resolve(v)) }) }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExperimentService,
        { provide: getRepositoryToken(Experiment), useValue: experimentRepo },
        { provide: getRepositoryToken(IExperimentVariant), useValue: variantRepo },
        { provide: getRepositoryToken(ExperimentMetric), useValue: { save: jest.fn() } },
        { provide: getRepositoryToken(VariantMetric), useValue: { save: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<ExperimentService>(ExperimentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── updateExperiment ──────────────────────────────────────────────────────

  describe('updateExperiment()', () => {
    it('updates and returns the experiment', async () => {
      const exp = makeExperiment();
      experimentRepo.findOne.mockResolvedValue(exp);
      const result = await service.updateExperiment('exp-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
      expect(experimentRepo.save).toHaveBeenCalled();
    });

    it('throws if experiment not found', async () => {
      experimentRepo.findOne.mockResolvedValue(null);
      await expect(service.updateExperiment('missing', {})).rejects.toThrow('not found');
    });
  });

  // ── addVariant ────────────────────────────────────────────────────────────

  describe('addVariant()', () => {
    it('adds a variant to an existing experiment', async () => {
      experimentRepo.findOne.mockResolvedValue(makeExperiment());
      variantRepo.save.mockResolvedValue(makeVariant({ name: 'New Variant' }));
      const result = await service.addVariant('exp-1', { name: 'New Variant' });
      expect(result.name).toBe('New Variant');
    });

    it('throws if experiment not found', async () => {
      experimentRepo.findOne.mockResolvedValue(null);
      await expect(service.addVariant('missing', {})).rejects.toThrow('not found');
    });
  });

  // ── removeVariant ─────────────────────────────────────────────────────────

  describe('removeVariant()', () => {
    it('soft-deletes the variant', async () => {
      await service.removeVariant('var-1');
      expect(variantRepo.softDelete).toHaveBeenCalledWith('var-1');
    });
  });

  // ── updateTrafficAllocation ───────────────────────────────────────────────

  describe('updateTrafficAllocation()', () => {
    it('throws if allocations do not sum to 1', async () => {
      const v1 = makeVariant({ id: 'v1' });
      const v2 = makeVariant({ id: 'v2' });
      experimentRepo.findOne.mockResolvedValue(makeExperiment({ variants: [v1, v2] }));
      await expect(service.updateTrafficAllocation('exp-1', { v1: 0.3, v2: 0.3 })).rejects.toThrow(
        'must sum to 1',
      );
    });

    it('throws if experiment not found', async () => {
      experimentRepo.findOne.mockResolvedValue(null);
      await expect(service.updateTrafficAllocation('missing', {})).rejects.toThrow('not found');
    });

    it('updates allocations within a transaction when sum is valid', async () => {
      const v1 = makeVariant({ id: 'v1' });
      const v2 = makeVariant({ id: 'v2' });
      experimentRepo.findOne.mockResolvedValue(makeExperiment({ variants: [v1, v2] }));
      await service.updateTrafficAllocation('exp-1', { v1: 0.5, v2: 0.5 });
      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });

  // ── getExperimentResults ──────────────────────────────────────────────────

  describe('getExperimentResults()', () => {
    it('throws if experiment not found', async () => {
      experimentRepo.findOne.mockResolvedValue(null);
      await expect(service.getExperimentResults('missing')).rejects.toThrow('not found');
    });

    it('returns structured results for a found experiment', async () => {
      const exp = makeExperiment({ variants: [makeVariant()] });
      experimentRepo.findOne.mockResolvedValue(exp);
      const result = (await service.getExperimentResults('exp-1')) as any;
      expect(result.experiment.id).toBe('exp-1');
      expect(result.variants).toHaveLength(1);
    });
  });

  // ── archiveExperiment ─────────────────────────────────────────────────────

  describe('archiveExperiment()', () => {
    it('sets status to ARCHIVED', async () => {
      experimentRepo.findOne.mockResolvedValue(makeExperiment());
      const result = await service.archiveExperiment('exp-1');
      expect(result.status).toBe(ExperimentStatus.ARCHIVED);
    });

    it('throws if experiment not found', async () => {
      experimentRepo.findOne.mockResolvedValue(null);
      await expect(service.archiveExperiment('missing')).rejects.toThrow('not found');
    });
  });

  // ── pauseExperiment ───────────────────────────────────────────────────────

  describe('pauseExperiment()', () => {
    it('pauses a running experiment', async () => {
      experimentRepo.findOne.mockResolvedValue(
        makeExperiment({ status: ExperimentStatus.RUNNING }),
      );
      const result = await service.pauseExperiment('exp-1');
      expect(result.status).toBe(ExperimentStatus.PAUSED);
    });

    it('throws if experiment is not running', async () => {
      experimentRepo.findOne.mockResolvedValue(makeExperiment({ status: ExperimentStatus.PAUSED }));
      await expect(service.pauseExperiment('exp-1')).rejects.toThrow('Only running');
    });

    it('throws if experiment not found', async () => {
      experimentRepo.findOne.mockResolvedValue(null);
      await expect(service.pauseExperiment('missing')).rejects.toThrow('not found');
    });
  });

  // ── resumeExperiment ──────────────────────────────────────────────────────

  describe('resumeExperiment()', () => {
    it('resumes a paused experiment', async () => {
      experimentRepo.findOne.mockResolvedValue(makeExperiment({ status: ExperimentStatus.PAUSED }));
      const result = await service.resumeExperiment('exp-1');
      expect(result.status).toBe(ExperimentStatus.RUNNING);
    });

    it('throws if experiment is not paused', async () => {
      experimentRepo.findOne.mockResolvedValue(
        makeExperiment({ status: ExperimentStatus.RUNNING }),
      );
      await expect(service.resumeExperiment('exp-1')).rejects.toThrow('Only paused');
    });

    it('throws if experiment not found', async () => {
      experimentRepo.findOne.mockResolvedValue(null);
      await expect(service.resumeExperiment('missing')).rejects.toThrow('not found');
    });
  });
});
