import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Experiment } from '../entities/experiment.entity';
import { IExperimentVariant } from '../entities/experiment-variant.entity';
import { VariantMetric } from '../entities/variant-metric.entity';

export interface ISignificanceResults {
  experimentId: string;
  confidenceLevel: number;
  variants: unknown[];
  statisticallySignificant: boolean;
}

export interface IEffectSizeResult {
  experimentId: string;
  controlVariantId: string;
  effectSizes: Array<{
    variantId: string;
    variantName: string;
    effectSize: number;
    interpretation: string;
  }>;
}

/**
 * Provides statistical Analysis operations.
 */
@Injectable()
export class StatisticalAnalysisService {
  private readonly logger = new Logger(StatisticalAnalysisService.name);

  constructor(
    @InjectRepository(Experiment)
    private readonly experimentRepository: Repository<Experiment>,
    @InjectRepository(VariantMetric)
    private readonly variantMetricRepository: Repository<VariantMetric>,
  ) {}

  async calculateStatisticalSignificance(experimentId: string): Promise<ISignificanceResults> {
    this.logger.log(`Calculating statistical significance for experiment: ${experimentId}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants', 'variants.metrics'],
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${experimentId} not found`);
    }

    const results: ISignificanceResults = {
      experimentId: experiment.id,
      confidenceLevel: experiment.confidenceLevel,
      variants: [],
      statisticallySignificant: false,
    };

    for (const variant of experiment.variants) {
      const variantAnalysis = await this.analyzeVariant(variant, experiment.confidenceLevel);
      results.variants.push(variantAnalysis);
    }

    const controlVariant = experiment.variants.find((v) => v.isControl);
    if (controlVariant) {
      const controlMetrics = await this.getVariantMetrics(controlVariant.id);
      results.statisticallySignificant = await this.checkSignificanceAgainstControl(
        experiment.variants,
        controlMetrics,
        experiment.confidenceLevel,
      );
    }

    return results;
  }

  async calculateEffectSize(experimentId: string): Promise<IEffectSizeResult> {
    this.logger.log(`Calculating effect size for experiment: ${experimentId}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants'],
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${experimentId} not found`);
    }

    const controlVariant = experiment.variants.find((v) => v.isControl);
    if (!controlVariant) {
      throw new Error('No control variant found');
    }

    const effectSizes: IEffectSizeResult['effectSizes'] = [];

    for (const variant of experiment.variants) {
      if (variant.id === controlVariant.id) continue;

      const controlMetrics = await this.getVariantMetrics(controlVariant.id);
      const variantMetrics = await this.getVariantMetrics(variant.id);
      const effectSize = this.calculateCohensD(controlMetrics, variantMetrics);

      effectSizes.push({
        variantId: variant.id,
        variantName: variant.name,
        effectSize,
        interpretation: this.interpretEffectSize(effectSize),
      });
    }

    return {
      experimentId: experiment.id,
      controlVariantId: controlVariant.id,
      effectSizes,
    };
  }

  private async analyzeVariant(
    variant: IExperimentVariant,
    confidenceLevel: number,
  ): Promise<Record<string, unknown>> {
    const metrics = await this.getVariantMetrics(variant.id);

    const analysis = {
      variantId: variant.id,
      variantName: variant.name,
      isControl: variant.isControl,
      metrics: [] as unknown[],
      overallPerformance: 0,
    };

    for (const metric of metrics) {
      const statisticalData = await this.calculateMetricStatistics(metric, confidenceLevel);
      analysis.metrics.push(statisticalData);

      const rate = statisticalData.conversionRate;
      const val = statisticalData.value as number | undefined;
      if (typeof rate === 'number') {
        analysis.overallPerformance += rate;
      } else if (typeof val === 'number') {
        analysis.overallPerformance += val;
      }
    }

    return analysis;
  }

  private async calculateMetricStatistics(metric: VariantMetric, confidenceLevel: number) {
    const standardError =
      metric.standardDeviation != null && metric.sampleSize > 0
        ? Number(metric.standardDeviation) / Math.sqrt(metric.sampleSize)
        : 0;

    const zScore = this.getZScore(confidenceLevel);
    const marginOfError = zScore * standardError;

    const metricValue = Number(metric.value);
    const confidenceIntervalLower = metricValue - marginOfError;
    const confidenceIntervalUpper = metricValue + marginOfError;

    const pValue = this.calculatePValue(metricValue, standardError);
    const alpha = Math.max(0, Math.min(1, 1 - confidenceLevel / 100));
    const isStatisticallySignificant = pValue < alpha;

    return {
      metricId: metric.id,
      value: metric.value,
      sampleSize: metric.sampleSize,
      conversionRate: metric.conversionRate,
      standardDeviation: metric.standardDeviation,
      confidenceInterval: [confidenceIntervalLower, confidenceIntervalUpper],
      pValue,
      isStatisticallySignificant,
    };
  }

  private async getVariantMetrics(variantId: string): Promise<VariantMetric[]> {
    return await this.variantMetricRepository.find({
      where: { variant: { id: variantId } },
    });
  }

  private async checkSignificanceAgainstControl(
    variants: IExperimentVariant[],
    controlMetrics: VariantMetric[],
    confidenceLevel: number,
  ): Promise<boolean> {
    const controlVariant = variants.find((v) => v.isControl);
    if (!controlVariant) return false;

    for (const variant of variants) {
      if (variant.id === controlVariant.id) continue;

      const variantMetrics = await this.getVariantMetrics(variant.id);

      for (let i = 0; i < controlMetrics.length && i < variantMetrics.length; i++) {
        const controlMetric = controlMetrics[i];
        const variantMetric = variantMetrics[i];
        const isSignificant = await this.compareMetrics(
          controlMetric,
          variantMetric,
          confidenceLevel,
        );
        if (isSignificant) {
          return true;
        }
      }
    }

    return false;
  }

  private async compareMetrics(
    metric1: VariantMetric,
    metric2: VariantMetric,
    confidenceLevel: number,
  ): Promise<boolean> {
    const pooledSE = Math.sqrt(
      Math.pow(Number(metric1.standardDeviation) || 0, 2) / (metric1.sampleSize || 1) +
        Math.pow(Number(metric2.standardDeviation) || 0, 2) / (metric2.sampleSize || 1),
    );

    const difference = Number(metric2.value) - Number(metric1.value);
    const z = pooledSE > 0 ? Math.abs(difference / pooledSE) : 0;

    const criticalZ = this.getZScore(confidenceLevel);

    return z > criticalZ;
  }

  private getZScore(confidenceLevel: number): number {
    const zScores: Record<number, number> = {
      90: 1.645,
      95: 1.96,
      99: 2.576,
    };

    return zScores[confidenceLevel] || 1.96;
  }

  private calculatePValue(value: number, standardError: number): number {
    if (standardError === 0) return 1;

    const zScore = Math.abs(value / standardError);
    return Math.max(0, Math.min(1, 1 / (1 + Math.exp(-zScore + 2))));
  }

  private calculateCohensD(
    controlMetrics: VariantMetric[],
    variantMetrics: VariantMetric[],
  ): number {
    if (controlMetrics.length === 0 || variantMetrics.length === 0) return 0;

    const controlMean =
      controlMetrics.reduce((sum, m) => sum + Number(m.value), 0) / controlMetrics.length;
    const variantMean =
      variantMetrics.reduce((sum, m) => sum + Number(m.value), 0) / variantMetrics.length;

    const denomC = Math.max(controlMetrics.length - 1, 1);
    const denomV = Math.max(variantMetrics.length - 1, 1);

    const controlVar =
      controlMetrics.reduce((sum, m) => sum + Math.pow(Number(m.value) - controlMean, 2), 0) /
      denomC;
    const variantVar =
      variantMetrics.reduce((sum, m) => sum + Math.pow(Number(m.value) - variantMean, 2), 0) /
      denomV;

    const pooledStdDev = Math.sqrt(
      ((controlMetrics.length - 1) * controlVar + (variantMetrics.length - 1) * variantVar) /
        Math.max(controlMetrics.length + variantMetrics.length - 2, 1),
    );

    return pooledStdDev > 0 ? Math.abs(variantMean - controlMean) / pooledStdDev : 0;
  }

  private interpretEffectSize(effectSize: number): string {
    if (effectSize < 0.2) return 'negligible';
    if (effectSize < 0.5) return 'small';
    if (effectSize < 0.8) return 'medium';
    return 'large';
  }
}
