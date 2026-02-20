import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Experiment } from '../entities/experiment.entity';
import { ExperimentVariant } from '../entities/experiment-variant.entity';
import { StatisticalAnalysisService } from '../analysis/statistical-analysis.service';
import { ExperimentStatus } from '../entities/experiment.entity';

export interface WinnerSelectionCriteria {
  confidenceLevel: number;
  minimumSampleSize: number;
  effectSizeThreshold: number;
  durationThreshold: number; // in days
}

@Injectable()
export class AutomatedDecisionService {
  private readonly logger = new Logger(AutomatedDecisionService.name);

  constructor(
    @InjectRepository(Experiment)
    private experimentRepository: Repository<Experiment>,
    @InjectRepository(ExperimentVariant)
    private variantRepository: Repository<ExperimentVariant>,
    private statisticalAnalysisService: StatisticalAnalysisService,
  ) {}

  /**
   * Automatically selects winner for an experiment
   */
  async autoSelectWinner(experimentId: string, criteria?: WinnerSelectionCriteria): Promise<any> {
    this.logger.log(`Auto-selecting winner for experiment: ${experimentId}`);

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

    const defaultCriteria: WinnerSelectionCriteria = {
      confidenceLevel: experiment.confidenceLevel || 95,
      minimumSampleSize: experiment.minimumSampleSize || 100,
      effectSizeThreshold: 0.1,
      durationThreshold: 7,
    };

    const selectionCriteria = { ...defaultCriteria, ...criteria };

    // Check if experiment meets duration threshold
    const experimentDuration = this.calculateExperimentDuration(experiment);
    if (experimentDuration < selectionCriteria.durationThreshold) {
      return {
        experimentId: experiment.id,
        decision: 'no_winner',
        reason: `Experiment duration (${experimentDuration} days) below threshold (${selectionCriteria.durationThreshold} days)`,
      };
    }

    // Perform statistical analysis
    const statisticalResults = await this.statisticalAnalysisService.calculateStatisticalSignificance(experimentId);
    
    // Check if results are statistically significant
    if (!statisticalResults.statisticallySignificant) {
      return {
        experimentId: experiment.id,
        decision: 'no_winner',
        reason: 'No statistically significant results found',
      };
    }

    // Find the winning variant
    const winner = await this.determineWinner(experiment, statisticalResults, selectionCriteria);

    if (winner) {
      // Mark winner
      winner.isWinner = true;
      await this.variantRepository.save(winner);

      // Update experiment status
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
    } else {
      return {
        experimentId: experiment.id,
        decision: 'no_winner',
        reason: 'No clear winner could be determined',
      };
    }
  }

  /**
   * Determines the winning variant based on analysis results
   */
  private async determineWinner(
    experiment: Experiment,
    statisticalResults: any,
    criteria: WinnerSelectionCriteria
  ): Promise<ExperimentVariant | null> {
    const controlVariant = experiment.variants.find(v => v.isControl);
    if (!controlVariant) return null;

    let bestVariant: ExperimentVariant | null = null;
    let bestPerformance = -Infinity;

    // Find the variant with the best performance that meets criteria
    for (const variantAnalysis of statisticalResults.variants) {
      const variant = experiment.variants.find(v => v.id === variantAnalysis.variantId);
      if (!variant || variant.isControl) continue;

      // Check minimum sample size
      const hasSufficientSample = variantAnalysis.metrics.every(
        (metric: any) => metric.sampleSize >= criteria.minimumSampleSize
      );

      if (!hasSufficientSample) continue;

      // Check if statistically significant
      const isSignificant = variantAnalysis.metrics.some(
        (metric: any) => metric.isStatisticallySignificant
      );

      if (!isSignificant) continue;

      // Check effect size
      const effectSize = await this.calculateEffectSizeForVariant(experiment.id, variant.id, controlVariant.id);
      if (effectSize < criteria.effectSizeThreshold) continue;

      // Compare performance (simplified - would be more complex in real implementation)
      const performance = variantAnalysis.overallPerformance;
      if (performance > bestPerformance) {
        bestPerformance = performance;
        bestVariant = variant;
      }
    }

    return bestVariant;
  }

  /**
   * Calculates effect size for a specific variant compared to control
   */
  private async calculateEffectSizeForVariant(
    experimentId: string,
    variantId: string,
    controlId: string
  ): Promise<number> {
    // This would use the statistical analysis service to calculate effect size
    // For now, returning a placeholder value
    return 0.25;
  }

  /**
   * Calculates effect size for the winning variant
   */
  private async calculateEffectSizeForWinner(experimentId: string, winnerId: string): Promise<number> {
    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants'],
    });

    const controlVariant = experiment?.variants.find(v => v.isControl);
    if (!controlVariant) return 0;

    return await this.calculateEffectSizeForVariant(experimentId, winnerId, controlVariant.id);
  }

  /**
   * Calculates experiment duration in days
   */
  private calculateExperimentDuration(experiment: Experiment): number {
    const startDate = new Date(experiment.startDate);
    const endDate = experiment.endDate ? new Date(experiment.endDate) : new Date();
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Checks if an experiment is ready for winner selection
   */
  async isReadyForWinnerSelection(experimentId: string): Promise<boolean> {
    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants'],
    });

    if (!experiment || experiment.status !== ExperimentStatus.RUNNING) {
      return false;
    }

    // Check if experiment has run for minimum duration
    const duration = this.calculateExperimentDuration(experiment);
    const minimumDuration = 7; // 7 days minimum

    if (duration < minimumDuration) {
      return false;
    }

    // Check if all variants have sufficient sample size
    const minimumSampleSize = experiment.minimumSampleSize || 100;
    
    for (const variant of experiment.variants) {
      // This would check actual sample sizes from metrics
      // For now, we'll assume variants are ready
    }

    return true;
  }

  /**
   * Gets automated decision recommendations
   */
  async getDecisionRecommendations(experimentId: string): Promise<any> {
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
      
      // Get potential winner
      const statisticalResults = await this.statisticalAnalysisService.calculateStatisticalSignificance(experimentId);
      if (statisticalResults.statisticallySignificant) {
        const winner = await this.determineWinner(
          experiment,
          statisticalResults,
          {
            confidenceLevel: experiment.confidenceLevel || 95,
            minimumSampleSize: experiment.minimumSampleSize || 100,
            effectSizeThreshold: 0.1,
            durationThreshold: 7,
          }
        );

        if (winner) {
          recommendations.winnerCandidate = winner.id;
          recommendations.recommendations.push(`Variant "${winner.name}" is the recommended winner`);
        }
      }
    } else {
      const remainingDays = Math.max(0, 7 - duration);
      recommendations.recommendations.push(`Wait ${remainingDays} more days before making decision`);
    }

    return recommendations;
  }

  /**
   * Auto-allocates traffic based on performance
   */
  async autoAllocateTraffic(experimentId: string): Promise<void> {
    this.logger.log(`Auto-allocating traffic for experiment: ${experimentId}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants'],
    });

    if (!experiment || !experiment.autoAllocateTraffic) {
      return;
    }

    // This would implement multi-armed bandit algorithm or similar
    // For now, we'll implement a simple performance-based allocation
    
    const variants = experiment.variants;
    if (variants.length < 2) return;

    // Calculate performance scores for each variant
    const performanceScores = await this.calculateVariantPerformanceScores(variants);

    // Allocate traffic proportionally to performance scores
    const totalScore = performanceScores.reduce((sum, score) => sum + score.score, 0);
    
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      const score = performanceScores[i];
      variant.trafficAllocation = totalScore > 0 ? score.score / totalScore : 1 / variants.length;
      await this.variantRepository.save(variant);
    }

    this.logger.log(`Traffic auto-allocated for experiment: ${experiment.name}`);
  }

  /**
   * Calculates performance scores for variants
   */
  private async calculateVariantPerformanceScores(variants: ExperimentVariant[]): Promise<any[]> {
    // This would fetch actual performance data
    // For now, returning equal scores
    return variants.map(variant => ({
      variantId: variant.id,
      score: 1.0, // Placeholder score
    }));
  }
}