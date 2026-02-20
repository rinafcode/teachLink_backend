import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Experiment } from './entities/experiment.entity';
import { ExperimentVariant } from './entities/experiment-variant.entity';
import { ExperimentStatus, ExperimentType } from './entities/experiment.entity';

export interface CreateExperimentDto {
  name: string;
  description: string;
  type: ExperimentType;
  startDate: Date;
  endDate?: Date;
  trafficAllocation: number;
  autoAllocateTraffic: boolean;
  confidenceLevel: number;
  minimumSampleSize: number;
  hypothesis: string;
  targetingCriteria?: any;
  exclusionCriteria?: any;
  variants: CreateVariantDto[];
  metrics: CreateMetricDto[];
}

export interface CreateVariantDto {
  name: string;
  description: string;
  configuration: any;
  isControl: boolean;
}

export interface CreateMetricDto {
  name: string;
  description: string;
  type: string;
  isPrimary: boolean;
  configuration?: any;
}

@Injectable()
export class ABTestingService {
  private readonly logger = new Logger(ABTestingService.name);

  constructor(
    @InjectRepository(Experiment)
    private experimentRepository: Repository<Experiment>,
    @InjectRepository(ExperimentVariant)
    private variantRepository: Repository<ExperimentVariant>,
  ) {}

  /**
   * Creates a new experiment
   */
  async createExperiment(createExperimentDto: CreateExperimentDto): Promise<Experiment> {
    this.logger.log(`Creating new experiment: ${createExperimentDto.name}`);

    const experiment = new Experiment();
    experiment.name = createExperimentDto.name;
    experiment.description = createExperimentDto.description;
    experiment.type = createExperimentDto.type;
    experiment.startDate = createExperimentDto.startDate;
    experiment.endDate = createExperimentDto.endDate;
    experiment.trafficAllocation = createExperimentDto.trafficAllocation;
    experiment.autoAllocateTraffic = createExperimentDto.autoAllocateTraffic;
    experiment.confidenceLevel = createExperimentDto.confidenceLevel;
    experiment.minimumSampleSize = createExperimentDto.minimumSampleSize;
    experiment.hypothesis = createExperimentDto.hypothesis;
    experiment.targetingCriteria = createExperimentDto.targetingCriteria;
    experiment.exclusionCriteria = createExperimentDto.exclusionCriteria;
    experiment.status = ExperimentStatus.DRAFT;

    // Save the experiment first
    const savedExperiment = await this.experimentRepository.save(experiment);

    // Create variants
    const variants = createExperimentDto.variants.map(variantDto => {
      const variant = new ExperimentVariant();
      variant.name = variantDto.name;
      variant.description = variantDto.description;
      variant.configuration = variantDto.configuration;
      variant.isControl = variantDto.isControl;
      variant.experiment = savedExperiment;
      return variant;
    });

    await this.variantRepository.save(variants);

    this.logger.log(`Experiment created successfully: ${savedExperiment.name}`);
    return savedExperiment;
  }

  /**
   * Gets all experiments
   */
  async getAllExperiments(): Promise<Experiment[]> {
    return await this.experimentRepository.find({
      relations: ['variants', 'metrics'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Gets experiment by ID
   */
  async getExperimentById(id: string): Promise<Experiment> {
    const experiment = await this.experimentRepository.findOne({
      where: { id },
      relations: ['variants', 'metrics', 'variants.metrics'],
    });

    if (!experiment) {
      throw new Error(`Experiment with ID ${id} not found`);
    }

    return experiment;
  }

  /**
   * Starts an experiment
   */
  async startExperiment(id: string): Promise<Experiment> {
    this.logger.log(`Starting experiment: ${id}`);

    const experiment = await this.getExperimentById(id);
    
    if (experiment.status !== ExperimentStatus.DRAFT) {
      throw new Error('Only draft experiments can be started');
    }

    if (!experiment.variants || experiment.variants.length < 2) {
      throw new Error('Experiment must have at least 2 variants');
    }

    // Validate that there's exactly one control variant
    const controlVariants = experiment.variants.filter(v => v.isControl);
    if (controlVariants.length !== 1) {
      throw new Error('Experiment must have exactly one control variant');
    }

    experiment.status = ExperimentStatus.RUNNING;
    experiment.startDate = new Date();

    const updatedExperiment = await this.experimentRepository.save(experiment);
    this.logger.log(`Experiment started: ${updatedExperiment.name}`);
    return updatedExperiment;
  }

  /**
   * Stops an experiment
   */
  async stopExperiment(id: string): Promise<Experiment> {
    this.logger.log(`Stopping experiment: ${id}`);

    const experiment = await this.getExperimentById(id);
    experiment.status = ExperimentStatus.COMPLETED;
    experiment.endDate = new Date();

    const updatedExperiment = await this.experimentRepository.save(experiment);
    this.logger.log(`Experiment stopped: ${updatedExperiment.name}`);
    return updatedExperiment;
  }

  /**
   * Gets active experiments for a user
   */
  async getActiveExperimentsForUser(userId: string): Promise<Experiment[]> {
    return await this.experimentRepository.find({
      where: {
        status: ExperimentStatus.RUNNING,
        startDate: new Date(),
      },
      relations: ['variants'],
    });
  }

  /**
   * Assigns a user to a variant
   */
  async assignUserToVariant(experimentId: string, userId: string): Promise<ExperimentVariant> {
    const experiment = await this.getExperimentById(experimentId);
    
    if (experiment.status !== ExperimentStatus.RUNNING) {
      throw new Error('Experiment is not running');
    }

    // Simple hash-based assignment for consistent user-to-variant mapping
    const variantIndex = this.hashUserIdToVariant(userId, experiment.variants.length);
    return experiment.variants[variantIndex];
  }

  /**
   * Hashes user ID to determine variant assignment
   */
  private hashUserIdToVariant(userId: string, variantCount: number): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % variantCount;
  }
}