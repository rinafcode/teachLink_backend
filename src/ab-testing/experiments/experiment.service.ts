import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Experiment } from '../entities/experiment.entity';
import { ExperimentVariant } from '../entities/experiment-variant.entity';
import { ExperimentMetric } from '../entities/experiment-metric.entity';
import { VariantMetric } from '../entities/variant-metric.entity';
import { ExperimentStatus, ExperimentType } from '../entities/experiment.entity';

@Injectable()
export class ExperimentService {
  private readonly logger = new Logger(ExperimentService.name);

  constructor(
    @InjectRepository(Experiment)
    private experimentRepository: Repository<Experiment>,
    @InjectRepository(ExperimentVariant)
    private variantRepository: Repository<ExperimentVariant>,
    @InjectRepository(ExperimentMetric)
    private experimentMetricRepository: Repository<ExperimentMetric>,
    @InjectRepository(VariantMetric)
    private variantMetricRepository: Repository<VariantMetric>,
  ) {}

  /**
   * Updates experiment configuration
   */
  async updateExperiment(id: string, updateData: Partial<Experiment>): Promise<Experiment> {
    this.logger.log(`Updating experiment: ${id}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id },
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${id} not found`);
    }

    Object.assign(experiment, updateData);
    const updatedExperiment = await this.experimentRepository.save(experiment);

    this.logger.log(`Experiment updated: ${updatedExperiment.name}`);
    return updatedExperiment;
  }

  /**
   * Adds a variant to an experiment
   */
  async addVariant(experimentId: string, variantData: Partial<ExperimentVariant>): Promise<ExperimentVariant> {
    this.logger.log(`Adding variant to experiment: ${experimentId}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${experimentId} not found`);
    }

    const variant = new ExperimentVariant();
    Object.assign(variant, variantData);
    variant.experiment = experiment;

    const savedVariant = await this.variantRepository.save(variant);
    this.logger.log(`Variant added: ${savedVariant.name}`);
    return savedVariant;
  }

  /**
   * Removes a variant from an experiment
   */
  async removeVariant(variantId: string): Promise<void> {
    this.logger.log(`Removing variant: ${variantId}`);
    await this.variantRepository.delete(variantId);
    this.logger.log(`Variant removed: ${variantId}`);
  }

  /**
   * Updates traffic allocation for variants
   */
  async updateTrafficAllocation(experimentId: string, allocations: Record<string, number>): Promise<void> {
    this.logger.log(`Updating traffic allocation for experiment: ${experimentId}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants'],
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${experimentId} not found`);
    }

    // Validate that allocations sum to 100%
    const totalAllocation = Object.values(allocations).reduce((sum, alloc) => sum + alloc, 0);
    if (Math.abs(totalAllocation - 1) > 0.01) {
      throw new Error('Traffic allocations must sum to 100%');
    }

    // Update each variant's allocation
    for (const variant of experiment.variants) {
      if (allocations[variant.id] !== undefined) {
        variant.trafficAllocation = allocations[variant.id];
        await this.variantRepository.save(variant);
      }
    }

    this.logger.log(`Traffic allocation updated for experiment: ${experiment.name}`);
  }

  /**
   * Gets experiment results
   */
  async getExperimentResults(experimentId: string): Promise<any> {
    this.logger.log(`Getting results for experiment: ${experimentId}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: ['variants', 'metrics', 'variants.metrics'],
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${experimentId} not found`);
    }

    // Calculate results for each variant
    const results = {
      experiment: {
        id: experiment.id,
        name: experiment.name,
        status: experiment.status,
        type: experiment.type,
      },
      variants: experiment.variants.map(variant => ({
        id: variant.id,
        name: variant.name,
        isControl: variant.isControl,
        isWinner: variant.isWinner,
        trafficAllocation: variant.trafficAllocation,
        metrics: variant.metrics.map(metric => ({
          id: metric.id,
          value: metric.value,
          sampleSize: metric.sampleSize,
          conversionRate: metric.conversionRate,
          confidenceInterval: [
            metric.confidenceIntervalLower,
            metric.confidenceIntervalUpper
          ],
          pValue: metric.pValue,
          isStatisticallySignificant: metric.isStatisticallySignificant,
        })),
      })),
    };

    return results;
  }

  /**
   * Archives an experiment
   */
  async archiveExperiment(id: string): Promise<Experiment> {
    this.logger.log(`Archiving experiment: ${id}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id },
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${id} not found`);
    }

    experiment.status = ExperimentStatus.ARCHIVED;
    const archivedExperiment = await this.experimentRepository.save(experiment);

    this.logger.log(`Experiment archived: ${archivedExperiment.name}`);
    return archivedExperiment;
  }

  /**
   * Pauses an experiment
   */
  async pauseExperiment(id: string): Promise<Experiment> {
    this.logger.log(`Pausing experiment: ${id}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id },
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${id} not found`);
    }

    if (experiment.status !== ExperimentStatus.RUNNING) {
      throw new Error('Only running experiments can be paused');
    }

    experiment.status = ExperimentStatus.PAUSED;
    const pausedExperiment = await this.experimentRepository.save(experiment);

    this.logger.log(`Experiment paused: ${pausedExperiment.name}`);
    return pausedExperiment;
  }

  /**
   * Resumes a paused experiment
   */
  async resumeExperiment(id: string): Promise<Experiment> {
    this.logger.log(`Resuming experiment: ${id}`);

    const experiment = await this.experimentRepository.findOne({
      where: { id },
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${id} not found`);
    }

    if (experiment.status !== ExperimentStatus.PAUSED) {
      throw new Error('Only paused experiments can be resumed');
    }

    experiment.status = ExperimentStatus.RUNNING;
    const resumedExperiment = await this.experimentRepository.save(experiment);

    this.logger.log(`Experiment resumed: ${resumedExperiment.name}`);
    return resumedExperiment;
  }
}