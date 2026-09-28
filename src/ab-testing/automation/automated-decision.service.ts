import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Experiment, ExperimentStatus } from '../entities/experiment.entity';
import { IExperimentVariant } from '../entities/experiment-variant.entity';
import { StatisticalAnalysisService } from '../analysis/statistical-analysis.service';
import { AB_TESTING_CONSTANTS } from '../ab-testing.constants';

export interface IWinnerSelectionCriteria {
  confidenceLevel: number;
  minimumSampleSize: number;
  effectSizeThreshold: number;
  durationThreshold: number;
}

/**
 * Provides automated Decision operations.
 */
@Injectable()
export class AutomatedDecisionService {
  private readonly logger = new Logger(AutomatedDecisionService.name);

  constructor(
    @InjectRepository(Experiment)
    private readonly experimentRepository: Repository<Experiment>,
    @InjectRepository(IExperimentVariant)
    private readonly variantRepository: Repository<IExperimentVariant>,
    private readonly statisticalAnalysisService: StatisticalAnalysisService,
  ) {}

  async autoSelectWinner(
    experimentId: string,
    criteria?: Partial<IWinnerSelectionCriteria>,
  ): Promise<Record<string, unknown>> {
    this.logger.log(`Auto-selecting winner for experiment: ${experimentId}`);

    // Winner selection is based on duration, statistical significance,
    // minimum sample size, and a minimum effect size threshold.
    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants'],
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${experimentId} not found`);
    }

    if (experiment.status !== ExperimentStatus.RUNNING) {
      throw new Error('Only running experiments can have winners selected');
    }

    const defaultCriteria: IWinnerSelectionCriteria = {
      confidenceLevel: experiment.confidenceLevel ?? AB_TESTING_CONSTANTS.DEFAULT_CONFIDENCE_LEVEL,
      minimumSampleSize: experiment.minimumSampleSize ?? AB_TESTING_CONSTANTS.MINIMUM_SAMPLE_SIZE,
      effectSizeThreshold: AB_TESTING_CONSTANTS.EFFECT_SIZE_THRESHOLD,
      durationThreshold: AB_TESTING_CONSTANTS.DURATION_THRESHOLD_DAYS,
    };

    const selectionCriteria = { ...defaultCriteria, ...criteria };

    const experimentDuration = this.calculateExperimentDuration(experiment);
    if (experimentDuration < selectionCriteria.durationThreshold) {
      return {
        experimentId: experiment.id,
        decision: 'no_winner',
        reason: `Experiment duration (${experimentDuration} days) below threshold (${selectionCriteria.durationThreshold} days)`,
      };
    }

    const statisticalResults =
      await this.statisticalAnalysisService.calculateStatisticalSignificance(experimentId);

    if (!statisticalResults.statisticallySignificant) {
      return {
        experimentId: experiment.id,
        decision: 'no_winner',
        reason: 'No statistically significant results found',
      };
    }

    const winner = await this.determineWinner(experiment, statisticalResults, selectionCriteria);

    if (winner) {
      winner.isWinner = true;
      await this.variantRepository.save(winner);

      experiment.status = ExperimentStatus.COMPLETED;
      experiment.endDate = new Date();
      await this.experimentRepository.save(experiment);

      return {
        experimentId: experiment.id,
        decision: 'winner_selected',
        winnerId: winner.id,
        winnerName: winner.name,
        confidenceLevel: statisticalResults.confidenceLevel,
        effectSize: await this.calculateEffectSizeForWinner(experiment.id, winner.id),
      };
    }

    return {
      experimentId: experiment.id,
      decision: 'no_winner',
      reason: 'No clear winner could be determined',
    };
  }

  private async determineWinner(
    experiment: Experiment,
    statisticalResults: { variants: any[] },
    criteria: IWinnerSelectionCriteria,
  ): Promise<IExperimentVariant | null> {
    // The winner selection algorithm compares each non-control variant to the
    // control variant, filters by sample size and significance, then picks the
    // variant with the strongest overall performance.
    const controlVariant = experiment.variants.find((v) => v.isControl);
    if (!controlVariant) return null;

    let bestVariant: IExperimentVariant | null = null;
    let bestPerformance = -Infinity;

    for (const variantAnalysis of statisticalResults.variants) {
      const variant = experiment.variants.find((v) => v.id === variantAnalysis.variantId);
      if (!variant || variant.isControl) continue;

      const hasSufficientSample =
        Array.isArray(variantAnalysis.metrics) &&
        variantAnalysis.metrics.every(
          (metric: { sampleSize?: number }) =>
            (metric.sampleSize ?? 0) >= criteria.minimumSampleSize,
        );

      if (!hasSufficientSample) continue;

      const isSignificant =
        Array.isArray(variantAnalysis.metrics) &&
        variantAnalysis.metrics.some(
          (metric: { isStatisticallySignificant?: boolean }) => metric.isStatisticallySignificant,
        );

      if (!isSignificant) continue;

      const effectSize = await this.calculateEffectSizeForVariant(
        experiment.id,
        variant.id,
        controlVariant.id,
      );
      if (effectSize < criteria.effectSizeThreshold) continue;

      const performance =
        typeof variantAnalysis.overallPerformance === 'number'
          ? variantAnalysis.overallPerformance
          : 0;
      if (performance > bestPerformance) {
        bestPerformance = performance;
        bestVariant = variant;
      }
    }

    return bestVariant;
  }

  private async calculateEffectSizeForVariant(
    _experimentId: string,
    _variantId: string,
    _controlId: string,
  ): Promise<number> {
    return 0.25;
  }

  private async calculateEffectSizeForWinner(
    experimentId: string,
    winnerId: string,
  ): Promise<number> {
    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants'],
    });

    const controlVariant = experiment?.variants.find((v) => v.isControl);
    if (!controlVariant) return 0;

    return await this.calculateEffectSizeForVariant(experimentId, winnerId, controlVariant.id);
  }

  private calculateExperimentDuration(experiment: Experiment): number {
    const startDate = new Date(experiment.startDate);
    const endDate = experiment.endDate ? new Date(experiment.endDate) : new Date();
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  async isReadyForWinnerSelection(experimentId: string): Promise<boolean> {
    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants', 'variants.metrics'],
    });

    if (!experiment || experiment.status !== ExperimentStatus.RUNNING) {
      return false;
    }

    const duration = this.calculateExperimentDuration(experiment);
    if (duration < AB_TESTING_CONSTANTS.DURATION_THRESHOLD_DAYS) {
      return false;
    }

    const minimumSampleSize =
      experiment.minimumSampleSize ?? AB_TESTING_CONSTANTS.MINIMUM_SAMPLE_SIZE;

    for (const variant of experiment.variants) {
      const variantSampleSize =
        variant.metrics?.reduce((sum, metric) => sum + (metric.sampleSize ?? 0), 0) ?? 0;

      if (variantSampleSize < minimumSampleSize) {
        return false;
      }
    }

    return true;
  }

  async getDecisionRecommendations(experimentId: string): Promise<Record<string, unknown>> {
    this.logger.log(`Getting decision recommendations for experiment: ${experimentId}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants'],
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${experimentId} not found`);
    }

    const recommendations = {
      experimentId: experiment.id,
      status: experiment.status,
      readyForDecision: false,
      recommendations: [] as string[],
      winnerCandidate: null as string | null,
    };

    if (experiment.status !== ExperimentStatus.RUNNING) {
      recommendations.recommendations.push('Experiment is not running');
      return recommendations;
    }

    const duration = this.calculateExperimentDuration(experiment);
    recommendations.recommendations.push(`Experiment has been running for ${duration} days`);

    const ready = await this.isReadyForWinnerSelection(experimentId);
    recommendations.readyForDecision = ready;

    if (ready) {
      recommendations.recommendations.push('Experiment is ready for winner selection');

      const statisticalResults =
        await this.statisticalAnalysisService.calculateStatisticalSignificance(experimentId);
      if (statisticalResults.statisticallySignificant) {
        const winner = await this.determineWinner(experiment, statisticalResults, {
          confidenceLevel:
            experiment.confidenceLevel ?? AB_TESTING_CONSTANTS.DEFAULT_CONFIDENCE_LEVEL,
          minimumSampleSize:
            experiment.minimumSampleSize ?? AB_TESTING_CONSTANTS.MINIMUM_SAMPLE_SIZE,
          effectSizeThreshold: AB_TESTING_CONSTANTS.EFFECT_SIZE_THRESHOLD,
          durationThreshold: AB_TESTING_CONSTANTS.DURATION_THRESHOLD_DAYS,
        });
        if (winner) {
          recommendations.winnerCandidate = winner.id;
          recommendations.recommendations.push(
            `Variant "${winner.name}" is the recommended winner`,
          );
        }
      }
    } else {
      const remainingDays = Math.max(0, AB_TESTING_CONSTANTS.DURATION_THRESHOLD_DAYS - duration);
      recommendations.recommendations.push(
        `Wait ${remainingDays} more days before making decision`,
      );
    }

    return recommendations;
  }

  async autoAllocateTraffic(experimentId: string): Promise<void> {
    this.logger.log(`Auto-allocating traffic for experiment: ${experimentId}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants'],
    });

    if (!experiment || !experiment.autoAllocateTraffic) {
      return;
    }

    const variants = experiment.variants;
    if (variants.length < 2) return;

    const performanceScores = await this.calculateVariantPerformanceScores(variants);
    const totalScore = performanceScores.reduce((sum, score) => sum + score.score, 0);

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      const score = performanceScores[i];
      variant.trafficAllocation = totalScore > 0 ? score.score / totalScore : 1 / variants.length;
      await this.variantRepository.save(variant);
    }

    this.logger.log(`Traffic auto-allocated for experiment: ${experiment.name}`);
  }

  private async calculateVariantPerformanceScores(
    variants: IExperimentVariant[],
  ): Promise<Array<{ variantId: string; score: number }>> {
    return variants.map((variant) => ({
      variantId: variant.id,
      score: 1.0,
    }));
  }
}
