import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ABTestingReportsService } from './ab-testing-reports.service';
import { Experiment, ExperimentStatus, ExperimentType } from '../entities/experiment.entity';
import { IExperimentVariant } from '../entities/experiment-variant.entity';
import { StatisticalAnalysisService } from '../analysis/statistical-analysis.service';
import { AutomatedDecisionService } from '../automation/automated-decision.service';

const makeVariant = (overrides: Partial<IExperimentVariant> = {}): IExperimentVariant =>
  ({
    id: 'var-1',
    name: 'Control',
    isControl: true,
    isWinner: false,
    trafficAllocation: 0.5,
    metrics: [],
    ...overrides,
  }) as IExperimentVariant;

const makeExperiment = (overrides: Partial<Experiment> = {}): Experiment =>
  ({
    id: 'exp-1',
    name: 'Test Experiment',
    description: 'desc',
    type: ExperimentType.A_B_TEST,
    status: ExperimentStatus.RUNNING,
    startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    endDate: undefined,
    confidenceLevel: 95,
    minimumSampleSize: 100,
    trafficAllocation: 1,
    hypothesis: 'H0',
    variants: [makeVariant()],
    metrics: [],
    createdAt: new Date(),
    ...overrides,
  }) as Experiment;

describe('ABTestingReportsService', () => {
  let service: ABTestingReportsService;
  let experimentRepo: { findOne: jest.Mock; find: jest.Mock; createQueryBuilder: jest.Mock };
  let variantRepo: { findOne: jest.Mock };
  let statisticalAnalysisService: { calculateStatisticalSignificance: jest.Mock };
  let automatedDecisionService: { getDecisionRecommendations: jest.Mock };

  beforeEach(async () => {
    const qb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    experimentRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    variantRepo = { findOne: jest.fn() };
    statisticalAnalysisService = {
      calculateStatisticalSignificance: jest.fn().mockResolvedValue({
        statisticallySignificant: false,
        confidenceLevel: 95,
        variants: [],
      }),
    };
    automatedDecisionService = {
      getDecisionRecommendations: jest.fn().mockResolvedValue({ recommendations: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ABTestingReportsService,
        { provide: getRepositoryToken(Experiment), useValue: experimentRepo },
        { provide: getRepositoryToken(IExperimentVariant), useValue: variantRepo },
        { provide: StatisticalAnalysisService, useValue: statisticalAnalysisService },
        { provide: AutomatedDecisionService, useValue: automatedDecisionService },
      ],
    }).compile();

    service = module.get<ABTestingReportsService>(ABTestingReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── generateExperimentReport ──────────────────────────────────────────────

  describe('generateExperimentReport()', () => {
    it('returns a structured report for a found experiment', async () => {
      experimentRepo.findOne.mockResolvedValue(makeExperiment());
      const report = await service.generateExperimentReport('exp-1');
      expect(report.experiment.id).toBe('exp-1');
      expect(report.variants).toHaveLength(1);
      expect(report.summary).toBeDefined();
    });

    it('throws if experiment not found', async () => {
      experimentRepo.findOne.mockResolvedValue(null);
      await expect(service.generateExperimentReport('missing')).rejects.toThrow('not found');
    });
  });

  // ── getDashboardSummary ───────────────────────────────────────────────────

  describe('getDashboardSummary()', () => {
    it('returns a summary with no experiments when list is empty', async () => {
      const summary = await service.getDashboardSummary();
      expect(summary.totalExperiments).toBe(0);
    });

    it('counts experiments by status', async () => {
      const qb = experimentRepo.createQueryBuilder();
      (qb.getMany as jest.Mock).mockResolvedValue([
        makeExperiment({ status: ExperimentStatus.RUNNING }),
        makeExperiment({ id: 'exp-2', status: ExperimentStatus.COMPLETED }),
      ]);
      const summary = await service.getDashboardSummary();
      expect(summary.runningExperiments).toBe(1);
      expect(summary.completedExperiments).toBe(1);
    });

    it('applies status filter when provided', async () => {
      await service.getDashboardSummary({ status: ExperimentStatus.RUNNING });
      const qb = experimentRepo.createQueryBuilder();
      expect(qb.andWhere).toHaveBeenCalled();
    });
  });

  // ── generatePerformanceComparisonReport ──────────────────────────────────

  describe('generatePerformanceComparisonReport()', () => {
    it('returns a report with zero comparisons when no completed experiments', async () => {
      experimentRepo.find.mockResolvedValue([]);
      const report = await service.generatePerformanceComparisonReport();
      expect(report.totalComparisons).toBe(0);
      expect(report.averageImprovement).toBe(0);
    });

    it('includes performance data when winner differs from control', async () => {
      const control = makeVariant({ id: 'ctrl', isControl: true, isWinner: false });
      const winner = makeVariant({ id: 'win', isControl: false, isWinner: true, name: 'Winner' });
      experimentRepo.find.mockResolvedValue([
        makeExperiment({ status: ExperimentStatus.COMPLETED, variants: [control, winner] }),
      ]);
      const report = await service.generatePerformanceComparisonReport();
      expect(report.totalComparisons).toBe(1);
      expect(report.bestPerforming).not.toBeNull();
    });
  });

  // ── exportExperimentData ──────────────────────────────────────────────────

  describe('exportExperimentData()', () => {
    it('throws if experiment not found', async () => {
      experimentRepo.findOne.mockResolvedValue(null);
      await expect(service.exportExperimentData('missing')).rejects.toThrow('not found');
    });

    it('returns a CSV string with header row', async () => {
      experimentRepo.findOne.mockResolvedValue(makeExperiment());
      const csv = await service.exportExperimentData('exp-1');
      expect(typeof csv).toBe('string');
      expect(csv).toContain('Metric');
    });
  });

  // ── getExperimentTimeline ─────────────────────────────────────────────────

  describe('getExperimentTimeline()', () => {
    it('returns an empty timeline when no experiments exist', async () => {
      experimentRepo.find.mockResolvedValue([]);
      const result = (await service.getExperimentTimeline()) as any;
      expect(result.totalExperiments).toBe(0);
      expect(result.timeline).toHaveLength(0);
    });

    it('returns timeline entries for each experiment', async () => {
      experimentRepo.find.mockResolvedValue([makeExperiment()]);
      const result = (await service.getExperimentTimeline()) as any;
      expect(result.totalExperiments).toBe(1);
      expect(result.timeline[0].id).toBe('exp-1');
    });
  });
});
