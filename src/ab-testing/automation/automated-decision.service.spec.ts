import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AutomatedDecisionService } from './automated-decision.service';
import { Experiment, ExperimentStatus } from '../entities/experiment.entity';
import { IExperimentVariant } from '../entities/experiment-variant.entity';
import { StatisticalAnalysisService } from '../analysis/statistical-analysis.service';
import { AB_TESTING_CONSTANTS } from '../ab-testing.constants';

const makeExperiment = (overrides: Partial<Experiment> = {}): Experiment =>
  ({
    id: 'exp-1',
    name: 'Test Exp',
    status: ExperimentStatus.RUNNING,
    confidenceLevel: 95,
    minimumSampleSize: 100,
    startDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
    endDate: undefined,
    autoAllocateTraffic: false,
    variants: [],
    ...overrides,
  } as Experiment);

const makeVariant = (overrides: Partial<IExperimentVariant> = {}): IExperimentVariant =>
  ({
    id: 'var-1',
    name: 'Variant A',
    isControl: false,
    isWinner: false,
    trafficAllocation: 0.5,
    metrics: [],
    ...overrides,
  } as IExperimentVariant);

describe('AutomatedDecisionService', () => {
  let service: AutomatedDecisionService;
  let experimentRepo: { findOne: jest.Mock; save: jest.Mock };
  let variantRepo: { save: jest.Mock };
  let statisticalAnalysisService: { calculateStatisticalSignificance: jest.Mock };

  beforeEach(async () => {
    experimentRepo = { findOne: jest.fn(), save: jest.fn((e) => Promise.resolve(e)) };
    variantRepo = { save: jest.fn((v) => Promise.resolve(v)) };
    statisticalAnalysisService = {
      calculateStatisticalSignificance: jest.fn().mockResolvedValue({
        statisticallySignificant: false,
        confidenceLevel: 95,
        variants: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomatedDecisionService,
        { provide: getRepositoryToken(Experiment), useValue: experimentRepo },
        { provide: getRepositoryToken(IExperimentVariant), useValue: variantRepo },
        { provide: StatisticalAnalysisService, useValue: statisticalAnalysisService },
      ],
    }).compile();

    service = module.get<AutomatedDecisionService>(AutomatedDecisionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── autoSelectWinner ──────────────────────────────────────────────────────

  describe('autoSelectWinner()', () => {
    it('throws if experiment not found', async () => {
      experimentRepo.findOne.mockResolvedValue(null);
      await expect(service.autoSelectWinner('missing')).rejects.toThrow('not found');
    });

    it('throws if experiment is not running', async () => {
      experimentRepo.findOne.mockResolvedValue(
        makeExperiment({ status: ExperimentStatus.COMPLETED }),
      );
      await expect(service.autoSelectWinner('exp-1')).rejects.toThrow(
        'Only running experiments can have winners selected',
      );
    });

    it('returns no_winner when experiment duration is below threshold', async () => {
      experimentRepo.findOne.mockResolvedValue(
        makeExperiment({ startDate: new Date() }), // 0 days
      );
      const result = await service.autoSelectWinner('exp-1');
      expect(result.decision).toBe('no_winner');
      expect((result.reason as string)).toMatch(/duration/i);
    });

    it('returns no_winner when results are not statistically significant', async () => {
      experimentRepo.findOne.mockResolvedValue(makeExperiment());
      statisticalAnalysisService.calculateStatisticalSignificance.mockResolvedValue({
        statisticallySignificant: false,
        confidenceLevel: 95,
        variants: [],
      });
      const result = await service.autoSelectWinner('exp-1');
      expect(result.decision).toBe('no_winner');
    });
  });

  // ── isReadyForWinnerSelection ─────────────────────────────────────────────

  describe('isReadyForWinnerSelection()', () => {
    it('returns false when experiment is not found', async () => {
      experimentRepo.findOne.mockResolvedValue(null);
      await expect(service.isReadyForWinnerSelection('missing')).resolves.toBe(false);
    });

    it('returns false when experiment is not running', async () => {
      experimentRepo.findOne.mockResolvedValue(
        makeExperiment({ status: ExperimentStatus.PAUSED }),
      );
      await expect(service.isReadyForWinnerSelection('exp-1')).resolves.toBe(false);
    });

    it('returns false when duration is below threshold', async () => {
      experimentRepo.findOne.mockResolvedValue(
        makeExperiment({ startDate: new Date(), variants: [] }),
      );
      await expect(service.isReadyForWinnerSelection('exp-1')).resolves.toBe(false);
    });

    it('returns true when duration and sample size are sufficient', async () => {
      const variant = makeVariant({
        metrics: [{ sampleSize: 500 } as any],
      });
      experimentRepo.findOne.mockResolvedValue(
        makeExperiment({
          minimumSampleSize: 10,
          variants: [variant],
        }),
      );
      await expect(service.isReadyForWinnerSelection('exp-1')).resolves.toBe(true);
    });
  });

  // ── getDecisionRecommendations ────────────────────────────────────────────

  describe('getDecisionRecommendations()', () => {
    it('throws if experiment not found', async () => {
      experimentRepo.findOne.mockResolvedValue(null);
      await expect(service.getDecisionRecommendations('missing')).rejects.toThrow('not found');
    });

    it('returns not-running recommendation when experiment is not running', async () => {
      experimentRepo.findOne.mockResolvedValue(
        makeExperiment({ status: ExperimentStatus.PAUSED }),
      );
      const result = await service.getDecisionRecommendations('exp-1');
      expect(result.recommendations).toContain('Experiment is not running');
    });

    it('returns readyForDecision=false when duration is insufficient', async () => {
      experimentRepo.findOne.mockResolvedValue(makeExperiment({ startDate: new Date() }));
      const result = await service.getDecisionRecommendations('exp-1');
      expect(result.readyForDecision).toBe(false);
    });
  });

  // ── autoAllocateTraffic ───────────────────────────────────────────────────

  describe('autoAllocateTraffic()', () => {
    it('does nothing when experiment is not found', async () => {
      experimentRepo.findOne.mockResolvedValue(null);
      await expect(service.autoAllocateTraffic('missing')).resolves.toBeUndefined();
      expect(variantRepo.save).not.toHaveBeenCalled();
    });

    it('does nothing when autoAllocateTraffic is false', async () => {
      experimentRepo.findOne.mockResolvedValue(
        makeExperiment({ autoAllocateTraffic: false }),
      );
      await expect(service.autoAllocateTraffic('exp-1')).resolves.toBeUndefined();
      expect(variantRepo.save).not.toHaveBeenCalled();
    });

    it('reallocates traffic when autoAllocateTraffic is true', async () => {
      const v1 = makeVariant({ id: 'v1', trafficAllocation: 0.5 });
      const v2 = makeVariant({ id: 'v2', isControl: true, trafficAllocation: 0.5 });
      experimentRepo.findOne.mockResolvedValue(
        makeExperiment({ autoAllocateTraffic: true, variants: [v1, v2] }),
      );
      await service.autoAllocateTraffic('exp-1');
      expect(variantRepo.save).toHaveBeenCalled();
    });
  });
});
