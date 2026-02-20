import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Experiment } from '../entities/experiment.entity';
import { ExperimentVariant } from '../entities/experiment-variant.entity';
import { VariantMetric } from '../entities/variant-metric.entity';

@Injectable()
export class StatisticalAnalysisService {
  private readonly logger = new Logger(StatisticalAnalysisService.name);

  constructor(
    @InjectRepository(Experiment)
    private experimentRepository: Repository<Experiment>,
    @InjectRepository(ExperimentVariant)
    private variantRepository: Repository<ExperimentVariant>,
    @InjectRepository(VariantMetric)
    private variantMetricRepository: Repository<VariantMetric>,
  ) {}

  /**
   * Calculates statistical significance for experiment results
   */
  async calculateStatisticalSignificance(experimentId: string): Promise<any> {
    this.logger.log(`Calculating statistical significance for experiment: ${experimentId}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants', 'variants.metrics'],
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${experimentId} not found`);
    }

    const results = {
      experimentId: experiment.id,
      confidenceLevel: experiment.confidenceLevel,
      variants: [],
      statisticallySignificant: false,
    };

    // Calculate statistics for each variant
    for (const variant of experiment.variants) {
      const variantAnalysis = await this.analyzeVariant(variant, experiment.confidenceLevel);
      results.variants.push(variantAnalysis);
    }

    // Check if any variant is statistically significant compared to control
    const controlVariant = experiment.variants.find(v => v.isControl);
    if (controlVariant) {
      const controlMetrics = await this.getVariantMetrics(controlVariant.id);
      results.statisticallySignificant = await this.checkSignificanceAgainstControl(
        experiment.variants,
        controlMetrics,
        experiment.confidenceLevel
      );
    }

    return results;
  }

  /**
   * Analyzes a single variant's metrics
   */
  private async analyzeVariant(variant: ExperimentVariant, confidenceLevel: number): Promise<any> {
    const metrics = await this.getVariantMetrics(variant.id);
    
    const analysis = {
      variantId: variant.id,
      variantName: variant.name,
      isControl: variant.isControl,
      metrics: [],
      overallPerformance: 0,
    };

    for (const metric of metrics) {
      const statisticalData = await this.calculateMetricStatistics(metric, confidenceLevel);
      analysis.metrics.push(statisticalData);
      
      // For overall performance, we'll use conversion rate or value depending on metric type
      if (statisticalData.conversionRate) {
        analysis.overallPerformance += statisticalData.conversionRate;
      } else {
        analysis.overallPerformance += statisticalData.value;
      }
    }

    return analysis;
  }

  /**
   * Calculates statistics for a specific metric
   */
  private async calculateMetricStatistics(metric: VariantMetric, confidenceLevel: number): Promise<any> {
    // Calculate standard error
    const standardError = metric.standardDeviation && metric.sampleSize > 0 
      ? metric.standardDeviation / Math.sqrt(metric.sampleSize) 
      : 0;

    // Calculate confidence interval
    const zScore = this.getZScore(confidenceLevel);
    const marginOfError = zScore * standardError;
    
    const confidenceIntervalLower = metric.value - marginOfError;
    const confidenceIntervalUpper = metric.value + marginOfError;

    // Simple p-value calculation (would be more complex in a real implementation)
    const pValue = this.calculatePValue(metric.value, standardError);

    // Determine if statistically significant
    const isStatisticallySignificant = pValue < (1 - (confidenceLevel / 100));

    return {
      metricId: metric.id,
      value: metric.value,
      sampleSize: metric.sampleSize,
      conversionRate: metric.conversionRate,
      standardDeviation: metric.standardDeviation,
      confidenceInterval: [confidenceIntervalLower, confidenceIntervalUpper],
      pValue: pValue,
      isStatisticallySignificant: isStatisticallySignificant,
    };
  }

  /**
   * Gets metrics for a variant
   */
  private async getVariantMetrics(variantId: string): Promise<VariantMetric[]> {
    return await this.variantMetricRepository.find({
      where: { variant: { id: variantId } },
    });
  }

  /**
   * Checks if any variant is significantly different from control
   */
  private async checkSignificanceAgainstControl(
    variants: ExperimentVariant[],
    controlMetrics: VariantMetric[],
    confidenceLevel: number
  ): Promise<boolean> {
    const controlVariant = variants.find(v => v.isControl);
    if (!controlVariant) return false;

    for (const variant of variants) {
      if (variant.id === controlVariant.id) continue;

      const variantMetrics = await this.getVariantMetrics(variant.id);
      
      // Compare each metric
      for (let i = 0; i < controlMetrics.length && i < variantMetrics.length; i++) {
        const controlMetric = controlMetrics[i];
        const variantMetric = variantMetrics[i];
        
        const isSignificant = await this.compareMetrics(
          controlMetric,
          variantMetric,
          confidenceLevel
        );
        
        if (isSignificant) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Compares two metrics for statistical significance
   */
  private async compareMetrics(
    metric1: VariantMetric,
    metric2: VariantMetric,
    confidenceLevel: number
  ): Promise<boolean> {
    // Calculate pooled standard error for comparison
    const pooledSE = Math.sqrt(
      Math.pow(metric1.standardDeviation || 0, 2) / (metric1.sampleSize || 1) +
      Math.pow(metric2.standardDeviation || 0, 2) / (metric2.sampleSize || 1)
    );

    // Calculate z-score for the difference
    const difference = metric2.value - metric1.value;
    const zScore = pooledSE > 0 ? Math.abs(difference / pooledSE) : 0;

    // Get critical z-value for the confidence level
    const criticalZ = this.getZScore(confidenceLevel);

    return zScore > criticalZ;
  }

  /**
   * Gets z-score for a given confidence level
   */
  private getZScore(confidenceLevel: number): number {
    const confidence = confidenceLevel / 100;
    const alpha = 1 - confidence;
    
    // Z-scores for common confidence levels
    const zScores: Record<number, number> = {
      90: 1.645,
      95: 1.96,
      99: 2.576,
    };

    return zScores[confidenceLevel] || 1.96; // Default to 95% confidence
  }

  /**
   * Calculates p-value (simplified implementation)
   */
  private calculatePValue(value: number, standardError: number): number {
    if (standardError === 0) return 1;
    
    // Simplified p-value calculation
    const zScore = Math.abs(value / standardError);
    // This is a very simplified approximation
    return Math.max(0, Math.min(1, 1 / (1 + Math.exp(-zScore + 2))));
  }

  /**
   * Calculates effect size
   */
  async calculateEffectSize(experimentId: string): Promise<any> {
    this.logger.log(`Calculating effect size for experiment: ${experimentId}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants'],
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${experimentId} not found`);
    }

    const controlVariant = experiment.variants.find(v => v.isControl);
    if (!controlVariant) {
      throw new Error('No control variant found');
    }

    const effectSizes = [];

    for (const variant of experiment.variants) {
      if (variant.id === controlVariant.id) continue;

      const controlMetrics = await this.getVariantMetrics(controlVariant.id);
      const variantMetrics = await this.getVariantMetrics(variant.id);

      const effectSize = await this.calculateCohensD(controlMetrics, variantMetrics);
      effectSizes.push({
        variantId: variant.id,
        variantName: variant.name,
        effectSize: effectSize,
        interpretation: this.interpretEffectSize(effectSize),
      });
    }

    return {
      experimentId: experiment.id,
      controlVariantId: controlVariant.id,
      effectSizes: effectSizes,
    };
  }

  /**
   * Calculates Cohen's d effect size
   */
  private async calculateCohensD(
    controlMetrics: VariantMetric[],
    variantMetrics: VariantMetric[]
  ): Promise<number> {
    if (controlMetrics.length === 0 || variantMetrics.length === 0) return 0;

    // Simplified Cohen's d calculation
    const controlMean = controlMetrics.reduce((sum, m) => sum + m.value, 0) / controlMetrics.length;
    const variantMean = variantMetrics.reduce((sum, m) => sum + m.value, 0) / variantMetrics.length;
    
    const controlStdDev = Math.sqrt(
      controlMetrics.reduce((sum, m) => sum + Math.pow(m.value - controlMean, 2), 0) / 
      (controlMetrics.length - 1)
    );
    
    const variantStdDev = Math.sqrt(
      variantMetrics.reduce((sum, m) => sum + Math.pow(m.value - variantMean, 2), 0) / 
      (variantMetrics.length - 1)
    );

    const pooledStdDev = Math.sqrt(
      ((controlMetrics.length - 1) * Math.pow(controlStdDev, 2) + 
       (variantMetrics.length - 1) * Math.pow(variantStdDev, 2)) / 
      (controlMetrics.length + variantMetrics.length - 2)
    );

    return pooledStdDev > 0 ? Math.abs(variantMean - controlMean) / pooledStdDev : 0;
  }

  /**
   * Interprets effect size magnitude
   */
  private interpretEffectSize(effectSize: number): string {
    if (effectSize < 0.2) return 'negligible';
    if (effectSize < 0.5) return 'small';
    if (effectSize < 0.8) return 'medium';
    return 'large';
  }
}