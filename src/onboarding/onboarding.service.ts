import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OnboardingStep } from './entities/onboarding-step.entity';
import { UserOnboardingProgress, OnboardingProgressStatus } from './entities/user-onboarding-progress.entity';
import { OnboardingReward } from './entities/onboarding-reward.entity';
import { CreateOnboardingStepDto, UpdateOnboardingStepDto } from './dto/onboarding-step.dto';
import { UpdateProgressDto, CompleteStepDto } from './dto/onboarding-progress.dto';
import { CreateOnboardingRewardDto, UpdateOnboardingRewardDto } from './dto/onboarding-reward.dto';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectRepository(OnboardingStep)
    private readonly onboardingStepRepository: Repository<OnboardingStep>,
    @InjectRepository(UserOnboardingProgress)
    private readonly progressRepository: Repository<UserOnboardingProgress>,
    @InjectRepository(OnboardingReward)
    private readonly rewardRepository: Repository<OnboardingReward>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Onboarding Steps Management ──────────────────────────────────────

  async createStep(createDto: CreateOnboardingStepDto): Promise<OnboardingStep> {
    const step = this.onboardingStepRepository.create(createDto);
    return this.onboardingStepRepository.save(step);
  }

  async findAllSteps(): Promise<OnboardingStep[]> {
    return this.onboardingStepRepository.find({
      where: { status: 'active' },
      order: { order: 'ASC' },
    });
  }

  async findStepById(id: string): Promise<OnboardingStep> {
    const step = await this.onboardingStepRepository.findOne({ where: { id } });
    if (!step) {
      throw new NotFoundException(`Onboarding step with ID ${id} not found`);
    }
    return step;
  }

  async updateStep(id: string, updateDto: UpdateOnboardingStepDto): Promise<OnboardingStep> {
    const step = await this.findStepById(id);
    Object.assign(step, updateDto);
    return this.onboardingStepRepository.save(step);
  }

  async deleteStep(id: string): Promise<void> {
    const result = await this.onboardingStepRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Onboarding step with ID ${id} not found`);
    }
  }

  // ─── User Progress Tracking ───────────────────────────────────────────

  async getUserProgress(userId: string): Promise<{
    overallProgress: number;
    totalSteps: number;
    completedSteps: number;
    steps: UserOnboardingProgress[];
    earnedRewards: any[];
  }> {
    const steps = await this.onboardingStepRepository.find({
      where: { status: 'active' },
      order: { order: 'ASC' },
    });

    const progressRecords = await this.progressRepository.find({
      where: { userId },
      relations: ['step'],
      order: { createdAt: 'ASC' },
    });

    const completedSteps = progressRecords.filter(
      (p) => p.status === OnboardingProgressStatus.COMPLETED,
    ).length;

    const overallProgress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

    const earnedRewards = await this.calculateEarnedRewards(userId, completedSteps);

    return {
      overallProgress: Math.round(overallProgress * 100) / 100,
      totalSteps: steps.length,
      completedSteps,
      steps: progressRecords,
      earnedRewards,
    };
  }

  async startStep(userId: string, stepId: string): Promise<UserOnboardingProgress> {
    const step = await this.findStepById(stepId);

    let progress = await this.progressRepository.findOne({
      where: { userId, stepId },
    });

    if (progress) {
      if (progress.status === OnboardingProgressStatus.COMPLETED) {
        throw new BadRequestException('This step is already completed');
      }
      if (progress.status === OnboardingProgressStatus.SKIPPED) {
        throw new BadRequestException('This step was skipped');
      }
      // Update existing in-progress record
      progress.status = OnboardingProgressStatus.IN_PROGRESS;
      progress.startedAt = progress.startedAt || new Date();
    } else {
      // Create new progress record
      progress = this.progressRepository.create({
        userId,
        stepId,
        status: OnboardingProgressStatus.IN_PROGRESS,
        startedAt: new Date(),
        progressPercentage: 0,
      });
    }

    return this.progressRepository.save(progress);
  }

  async updateStepProgress(
    userId: string,
    stepId: string,
    updateDto: UpdateProgressDto,
  ): Promise<UserOnboardingProgress> {
    const progress = await this.progressRepository.findOne({
      where: { userId, stepId },
    });

    if (!progress) {
      throw new NotFoundException('Progress record not found. Start the step first.');
    }

    if (progress.status === OnboardingProgressStatus.COMPLETED) {
      throw new BadRequestException('This step is already completed');
    }

    progress.progressPercentage = updateDto.progressPercentage;
    progress.status = OnboardingProgressStatus.IN_PROGRESS;

    if (updateDto.timeSpentSeconds) {
      progress.timeSpentSeconds += updateDto.timeSpentSeconds;
    }

    if (updateDto.metadata) {
      progress.metadata = { ...progress.metadata, ...updateDto.metadata };
    }

    return this.progressRepository.save(progress);
  }

  async completeStep(
    userId: string,
    stepId: string,
    completeDto?: CompleteStepDto,
  ): Promise<{
    progress: UserOnboardingProgress;
    rewards: any[];
    nextStep?: OnboardingStep;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const progress = await queryRunner.manager.findOne(UserOnboardingProgress, {
        where: { userId, stepId },
      });

      if (!progress) {
        throw new NotFoundException('Progress record not found. Start the step first.');
      }

      if (progress.status === OnboardingProgressStatus.COMPLETED) {
        throw new BadRequestException('This step is already completed');
      }

      // Update progress
      progress.status = OnboardingProgressStatus.COMPLETED;
      progress.progressPercentage = 100;
      progress.completedAt = new Date();

      if (completeDto?.timeSpentSeconds) {
        progress.timeSpentSeconds += completeDto.timeSpentSeconds;
      }

      if (completeDto?.metadata) {
        progress.metadata = { ...progress.metadata, ...completeDto.metadata };
      }

      await queryRunner.manager.save(progress);

      // Get step details for reward calculation
      const step = await queryRunner.manager.findOne(OnboardingStep, { where: { id: stepId } });

      // Award points if configured
      if (step && step.rewardPoints > 0) {
        this.logger.log(`Awarding ${step.rewardPoints} points to user ${userId} for completing step ${stepId}`);
        // Points would be awarded through gamification service integration
      }

      await queryRunner.commitTransaction();

      // Calculate overall progress and check for rewards
      const userProgress = await this.getUserProgress(userId);
      const rewards = await this.checkAndAwardRewards(userId, userProgress.completedSteps);

      // Get next step
      const nextStep = await this.getNextIncompleteStep(userId);

      return {
        progress,
        rewards,
        nextStep,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async skipStep(userId: string, stepId: string): Promise<UserOnboardingProgress> {
    const step = await this.findStepById(stepId);

    if (step.isRequired) {
      throw new BadRequestException('Required steps cannot be skipped');
    }

    let progress = await this.progressRepository.findOne({
      where: { userId, stepId },
    });

    if (progress) {
      if (progress.status === OnboardingProgressStatus.COMPLETED) {
        throw new BadRequestException('Cannot skip a completed step');
      }
      progress.status = OnboardingProgressStatus.SKIPPED;
      progress.skippedAt = new Date();
    } else {
      progress = this.progressRepository.create({
        userId,
        stepId,
        status: OnboardingProgressStatus.SKIPPED,
        skippedAt: new Date(),
      });
    }

    return this.progressRepository.save(progress);
  }

  async getNextIncompleteStep(userId: string): Promise<OnboardingStep | null> {
    const allSteps = await this.onboardingStepRepository.find({
      where: { status: 'active' },
      order: { order: 'ASC' },
    });

    const completedProgress = await this.progressRepository.find({
      where: { userId, status: OnboardingProgressStatus.COMPLETED },
    });

    const completedStepIds = new Set(completedProgress.map((p) => p.stepId));

    const nextStep = allSteps.find((step) => !completedStepIds.has(step.id));

    return nextStep || null;
  }

  // ─── Rewards Management ───────────────────────────────────────────────

  async createReward(createDto: CreateOnboardingRewardDto): Promise<OnboardingReward> {
    const reward = this.rewardRepository.create(createDto);
    return this.rewardRepository.save(reward);
  }

  async findAllRewards(): Promise<OnboardingReward[]> {
    return this.rewardRepository.find({
      where: { isActive: true },
      order: { requiredSteps: 'ASC' },
    });
  }

  async findRewardById(id: string): Promise<OnboardingReward> {
    const reward = await this.rewardRepository.findOne({ where: { id } });
    if (!reward) {
      throw new NotFoundException(`Onboarding reward with ID ${id} not found`);
    }
    return reward;
  }

  async updateReward(id: string, updateDto: UpdateOnboardingRewardDto): Promise<OnboardingReward> {
    const reward = await this.findRewardById(id);
    Object.assign(reward, updateDto);
    return this.rewardRepository.save(reward);
  }

  async deleteReward(id: string): Promise<void> {
    const result = await this.rewardRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Onboarding reward with ID ${id} not found`);
    }
  }

  // ─── Helper Methods ───────────────────────────────────────────────────

  private async calculateEarnedRewards(
    userId: string,
    completedSteps: number,
  ): Promise<any[]> {
    const eligibleRewards = await this.rewardRepository.find({
      where: {
        isActive: true,
        requiredSteps: completedSteps,
      },
    });

    return eligibleRewards.map((reward) => ({
      id: reward.id,
      name: reward.name,
      type: reward.type,
      description: reward.description,
      earnedAt: new Date(),
    }));
  }

  private async checkAndAwardRewards(
    userId: string,
    completedSteps: number,
  ): Promise<any[]> {
    const eligibleRewards = await this.rewardRepository.find({
      where: {
        isActive: true,
        requiredSteps: completedSteps,
      },
    });

    if (eligibleRewards.length > 0) {
      this.logger.log(
        `User ${userId} earned ${eligibleRewards.length} reward(s) for completing ${completedSteps} steps`,
      );
    }

    return eligibleRewards.map((reward) => ({
      id: reward.id,
      name: reward.name,
      type: reward.type,
      description: reward.description,
      pointsValue: reward.pointsValue,
      badgeId: reward.badgeId,
      couponCode: reward.couponCode,
      metadata: reward.metadata,
    }));
  }
}
