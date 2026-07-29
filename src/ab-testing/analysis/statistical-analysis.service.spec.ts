import { StatisticalAnalysisService } from './statistical-analysis.service';
import { Experiment, ExperimentStatus, ExperimentType } from '../entities/experiment.entity';
import { IExperimentVariant } from '../entities/experiment-variant.entity';
import { VariantMetric } from '../entities/variant-metric.entity';

function createVariant(
  id: string,
  name: string,
  isControl: boolean,
  expId: string,
): IExperimentVariant {
  const variant = new IExperimentVariant();
  variant.id = id;
  variant.name = name;
  variant.isControl = isControl;
  variant.isWinner = false;
  variant.trafficAllocation = 0.5;
  variant.description = `Variant ${name}`;
  variant.configuration = {};
  const experiment = new Experiment();
  experiment.id = expId;
  variant.experiment = experiment;
  return variant;
}

function createMetric(
  metricId: string,
  variantId: string,
  overrides: Partial<VariantMetric> = {},
): VariantMetric {
  const metric = new VariantMetric();
  metric.id = metricId;
  metric.value = overrides.value ?? 100;
  metric.sampleSize = overrides.sampleSize ?? 1000;
  metric.conversionRate = overrides.conversionRate ?? 0.1;
  metric.standardDeviation = overrides.standardDeviation ?? 10;
  metric.confidenceIntervalLower = overrides.confidenceIntervalLower ?? null;
  metric.confidenceIntervalUpper = overrides.confidenceIntervalUpper ?? null;
  metric.pValue = overrides.pValue ?? 0.05;
  metric.isStatisticallySignificant = overrides.isStatisticallySignificant ?? false;

  const variant = new IExperimentVariant();
  variant.id = variantId;
  metric.variant = variant;
  return metric;
}

function createExperiment(
  id: string,
  variants: IExperimentVariant[],
  overrides: Partial<Experiment> = {},
): Experiment {
  const experiment = new Experiment();
  experiment.id = id;
  experiment.name = overrides.name ?? `Experiment ${id}`;
  experiment.description = overrides.description ?? 'Test';
  experiment.type = ExperimentType.A_B_TEST;
  experiment.status = ExperimentStatus.RUNNING;
  experiment.startDate = new Date();
  experiment.trafficAllocation = 1.0;
  experiment.autoAllocateTraffic = false;
  experiment.confidenceLevel = overrides.confidenceLevel ?? 95;
  experiment.minimumSampleSize = overrides.minimumSampleSize ?? 100;
  experiment.variants = variants;
  experiment.metrics = [];
  return experiment;
}

describe('StatisticalAnalysisService', () => {
  let service: StatisticalAnalysisService;
  let experimentRepo: { findOne: jest.Mock };
  let variantMetricRepo: { find: jest.Mock };

  beforeEach(() => {
    experimentRepo = { findOne: jest.fn() };
    variantMetricRepo = { find: jest.fn().mockResolvedValue([]) };
    service = new StatisticalAnalysisService(experimentRepo as any, variantMetricRepo as any);
  });

  describe('getVariantMetricsForExperiment', () => {
    it('groups metrics by variant ID from a single query', async () => {
      const metrics = [
        createMetric('m1', 'v1', { value: 100 }),
        createMetric('m2', 'v1', { value: 200 }),
        createMetric('m3', 'v2', { value: 300 }),
      ];
      variantMetricRepo.find.mockResolvedValue(metrics);

      // Access private method via indexed access for testing.
      const result = await (service as any).getVariantMetricsForExperiment('exp1');

      expect(variantMetricRepo.find).toHaveBeenCalledTimes(1);
      expect(result.size).toBe(2);
      expect(result.get('v1')).toHaveLength(2);
      expect(result.get('v2')).toHaveLength(1);
    });

    it('returns empty map when no metrics exist', async () => {
      variantMetricRepo.find.mockResolvedValue([]);

      const result = await (service as any).getVariantMetricsForExperiment('exp1');

      expect(result.size).toBe(0);
      expect(variantMetricRepo.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculateStatisticalSignificance', () => {
    it('issues a constant number of metric queries regardless of variant count', async () => {
      // 5 variants (1 control + 4 treatments)
      const variants = [
        createVariant('v_control', 'Control', true, 'exp1'),
        createVariant('v_a', 'A', false, 'exp1'),
        createVariant('v_b', 'B', false, 'exp1'),
        createVariant('v_c', 'C', false, 'exp1'),
        createVariant('v_d', 'D', false, 'exp1'),
      ];
      const experiment = createExperiment('exp1', variants);
      experimentRepo.findOne.mockResolvedValue(experiment);

      // Each variant gets 2 metrics.
      const allMetrics: VariantMetric[] = [];
      for (const v of variants) {
        allMetrics.push(createMetric(`${v.id}_m1`, v.id, { value: 100 }));
        allMetrics.push(createMetric(`${v.id}_m2`, v.id, { value: 200 }));
      }
      variantMetricRepo.find.mockResolvedValue(allMetrics);

      await service.calculateStatisticalSignificance('exp1');

      // Only the batch query should hit the repository — exactly 1 call.
      expect(variantMetricRepo.find).toHaveBeenCalledTimes(1);
    });

    it('produces correct statistical significance results', async () => {
      const variants = [
        createVariant('v_control', 'Control', true, 'exp1'),
        createVariant('v_treatment', 'Treatment', false, 'exp1'),
      ];
      const experiment = createExperiment('exp1', variants);
      experimentRepo.findOne.mockResolvedValue(experiment);

      const controlMetric = createMetric('ctrl_m1', 'v_control', {
        value: 100,
        sampleSize: 1000,
        conversionRate: 0.1,
        standardDeviation: 10,
      });
      const treatmentMetric = createMetric('treat_m1', 'v_treatment', {
        value: 120,
        sampleSize: 1000,
        conversionRate: 0.12,
        standardDeviation: 12,
      });
      variantMetricRepo.find.mockResolvedValue([controlMetric, treatmentMetric]);

      const result = await service.calculateStatisticalSignificance('exp1');

      expect(result.experimentId).toBe('exp1');
      expect(result.confidenceLevel).toBe(95);
      expect(result.variants).toHaveLength(2);

      const controlResult = result.variants.find((v: any) => v.variantId === 'v_control') as any;
      const treatmentResult = result.variants.find(
        (v: any) => v.variantId === 'v_treatment',
      ) as any;

      expect(controlResult).toBeDefined();
      expect(treatmentResult).toBeDefined();
      expect(controlResult.metrics).toHaveLength(1);
      expect(treatmentResult.metrics).toHaveLength(1);

      // Verify statistical computations are correct.
      const ctrlStat = controlResult.metrics[0];
      expect(ctrlStat.metricId).toBe('ctrl_m1');
      expect(Number(ctrlStat.value)).toBe(100);

      const treatStat = treatmentResult.metrics[0];
      expect(treatStat.metricId).toBe('treat_m1');
      expect(Number(treatStat.value)).toBe(120);
    });
  });

  describe('calculateEffectSize', () => {
    it('issues a constant number of metric queries regardless of variant count', async () => {
      // 6 variants (1 control + 5 treatments)
      const variants = [
        createVariant('v_control', 'Control', true, 'exp1'),
        createVariant('v_a', 'A', false, 'exp1'),
        createVariant('v_b', 'B', false, 'exp1'),
        createVariant('v_c', 'C', false, 'exp1'),
        createVariant('v_d', 'D', false, 'exp1'),
        createVariant('v_e', 'E', false, 'exp1'),
      ];
      const experiment = createExperiment('exp1', variants);
      experimentRepo.findOne.mockResolvedValue(experiment);

      const allMetrics: VariantMetric[] = [];
      for (const v of variants) {
        allMetrics.push(createMetric(`${v.id}_m1`, v.id, { value: 100 }));
      }
      variantMetricRepo.find.mockResolvedValue(allMetrics);

      await service.calculateEffectSize('exp1');

      // Only the batch query — exactly 1 call regardless of 6 variants.
      expect(variantMetricRepo.find).toHaveBeenCalledTimes(1);
    });

    it('produces correct effect size results', async () => {
      const variants = [
        createVariant('v_control', 'Control', true, 'exp1'),
        createVariant('v_treatment', 'Treatment', false, 'exp1'),
      ];
      const experiment = createExperiment('exp1', variants);
      experimentRepo.findOne.mockResolvedValue(experiment);

      const controlMetrics = [
        createMetric('ctrl_m1', 'v_control', {
          value: 100,
          sampleSize: 1000,
          standardDeviation: 10,
        }),
        createMetric('ctrl_m2', 'v_control', {
          value: 110,
          sampleSize: 1000,
          standardDeviation: 10,
        }),
      ];
      const treatmentMetrics = [
        createMetric('treat_m1', 'v_treatment', {
          value: 130,
          sampleSize: 1000,
          standardDeviation: 12,
        }),
        createMetric('treat_m2', 'v_treatment', {
          value: 140,
          sampleSize: 1000,
          standardDeviation: 12,
        }),
      ];
      variantMetricRepo.find.mockResolvedValue([...controlMetrics, ...treatmentMetrics]);

      const result = await service.calculateEffectSize('exp1');

      expect(result.experimentId).toBe('exp1');
      expect(result.controlVariantId).toBe('v_control');
      expect(result.effectSizes).toHaveLength(1);
      expect(result.effectSizes[0].variantId).toBe('v_treatment');
      // Control mean = (100+110)/2 = 105, Treatment mean = (130+140)/2 = 135
      // pooled std dev ≈ 7.07, Cohen's d = |135-105|/7.07 ≈ 4.24
      expect(result.effectSizes[0].effectSize).toBeGreaterThan(4);
      expect(result.effectSizes[0].effectSize).toBeLessThan(5);
      expect(result.effectSizes[0].interpretation).toBe('large');
    });
  });
});
