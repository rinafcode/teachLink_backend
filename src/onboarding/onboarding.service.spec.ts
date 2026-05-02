import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OnboardingService } from './onboarding.service';
import { OnboardingStep, OnboardingStepType, OnboardingStepStatus } from './entities/onboarding-step.entity';
import { UserOnboardingProgress, OnboardingProgressStatus } from './entities/user-onboarding-progress.entity';
import { OnboardingReward, RewardType } from './entities/onboarding-reward.entity';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let stepRepository: jest.Mocked<Repository<OnboardingStep>>;
  let progressRepository: jest.Mocked<Repository<UserOnboardingProgress>>;
  let rewardRepository: jest.Mocked<Repository<OnboardingReward>>;
  let mockDataSource: any;

  const mockStep: OnboardingStep = {
    id: 'step-1',
    version: 1,
    slug: 'profile-setup',
    title: 'Set Up Your Profile',
    description: 'Complete your profile',
    type: OnboardingStepType.PROFILE_SETUP,
    order: 1,
    status: OnboardingStepStatus.ACTIVE,
    rewardPoints: 50,
    isRequired: true,
    estimatedDurationMinutes: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProgress: UserOnboardingProgress = {
    id: 'progress-1',
    version: 1,
    userId: 'user-1',
    stepId: 'step-1',
    status: OnboardingProgressStatus.IN_PROGRESS,
    progressPercentage: 0,
    timeSpentSeconds: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as UserOnboardingProgress;

  const mockReward: OnboardingReward = {
    id: 'reward-1',
    version: 1,
    name: 'Completion Bonus',
    description: 'Awarded for completing all steps',
    type: RewardType.POINTS,
    pointsValue: 100,
    requiredSteps: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          findOne: jest.fn(),
          save: jest.fn(),
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        {
          provide: getRepositoryToken(OnboardingStep),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserOnboardingProgress),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OnboardingReward),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
    stepRepository = module.get(getRepositoryToken(OnboardingStep));
    progressRepository = module.get(getRepositoryToken(UserOnboardingProgress));
    rewardRepository = module.get(getRepositoryToken(OnboardingReward));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createStep', () => {
    it('should create a new onboarding step', async () => {
      const createDto = {
        slug: 'profile-setup',
        title: 'Set Up Your Profile',
        description: 'Complete your profile',
        type: OnboardingStepType.PROFILE_SETUP,
        order: 1,
        isRequired: true,
      };

      stepRepository.create.mockReturnValue(mockStep as any);
      stepRepository.save.mockResolvedValue(mockStep as any);

      const result = await service.createStep(createDto);

      expect(stepRepository.create).toHaveBeenCalledWith(createDto);
      expect(stepRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockStep);
    });
  });

  describe('findAllSteps', () => {
    it('should return all active steps ordered by order', async () => {
      const steps = [mockStep];
      stepRepository.find.mockResolvedValue(steps as any);

      const result = await service.findAllSteps();

      expect(stepRepository.find).toHaveBeenCalledWith({
        where: { status: 'active' },
        order: { order: 'ASC' },
      });
      expect(result).toEqual(steps);
    });
  });

  describe('findStepById', () => {
    it('should return a step by id', async () => {
      stepRepository.findOne.mockResolvedValue(mockStep as any);

      const result = await service.findStepById('step-1');

      expect(stepRepository.findOne).toHaveBeenCalledWith({ where: { id: 'step-1' } });
      expect(result).toEqual(mockStep);
    });

    it('should throw NotFoundException when step not found', async () => {
      stepRepository.findOne.mockResolvedValue(null);

      await expect(service.findStepById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStep', () => {
    it('should update a step', async () => {
      const updateDto = { title: 'Updated Title' };
      stepRepository.findOne.mockResolvedValue(mockStep as any);
      stepRepository.save.mockResolvedValue({ ...mockStep, ...updateDto } as any);

      const result = await service.updateStep('step-1', updateDto);

      expect(stepRepository.save).toHaveBeenCalled();
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('deleteStep', () => {
    it('should delete a step', async () => {
      stepRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.deleteStep('step-1');

      expect(stepRepository.delete).toHaveBeenCalledWith('step-1');
    });

    it('should throw NotFoundException when step not found', async () => {
      stepRepository.delete.mockResolvedValue({ affected: 0 } as any);

      await expect(service.deleteStep('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserProgress', () => {
    it('should calculate overall progress correctly', async () => {
      const steps = [mockStep, { ...mockStep, id: 'step-2' }];
      const progressRecords = [
        { ...mockProgress, status: OnboardingProgressStatus.COMPLETED },
      ];

      stepRepository.find.mockResolvedValue(steps as any);
      progressRepository.find.mockResolvedValue(progressRecords as any);
      rewardRepository.find.mockResolvedValue([]);

      const result = await service.getUserProgress('user-1');

      expect(result.totalSteps).toBe(2);
      expect(result.completedSteps).toBe(1);
      expect(result.overallProgress).toBe(50);
    });
  });

  describe('startStep', () => {
    it('should start a new step', async () => {
      stepRepository.findOne.mockResolvedValue(mockStep as any);
      progressRepository.findOne.mockResolvedValue(null);
      progressRepository.create.mockReturnValue(mockProgress as any);
      progressRepository.save.mockResolvedValue(mockProgress as any);

      const result = await service.startStep('user-1', 'step-1');

      expect(progressRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          stepId: 'step-1',
          status: OnboardingProgressStatus.IN_PROGRESS,
        }),
      );
      expect(result.status).toBe(OnboardingProgressStatus.IN_PROGRESS);
    });

    it('should throw BadRequestException when step already completed', async () => {
      stepRepository.findOne.mockResolvedValue(mockStep as any);
      progressRepository.findOne.mockResolvedValue({
        ...mockProgress,
        status: OnboardingProgressStatus.COMPLETED,
      } as any);

      await expect(service.startStep('user-1', 'step-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('completeStep', () => {
    it('should complete a step and check for rewards', async () => {
      const queryRunner = mockDataSource.createQueryRunner();
      
      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockProgress) // progress
        .mockResolvedValueOnce(mockStep); // step
      
      queryRunner.manager.save.mockResolvedValue({
        ...mockProgress,
        status: OnboardingProgressStatus.COMPLETED,
        completedAt: new Date(),
      });

      progressRepository.find.mockResolvedValue([]);
      stepRepository.find.mockResolvedValue([mockStep]);
      rewardRepository.find.mockResolvedValue([mockReward]);

      const result = await service.completeStep('user-1', 'step-1');

      expect(result.progress.status).toBe(OnboardingProgressStatus.COMPLETED);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('skipStep', () => {
    it('should skip an optional step', async () => {
      const optionalStep = { ...mockStep, isRequired: false };
      stepRepository.findOne.mockResolvedValue(optionalStep as any);
      progressRepository.findOne.mockResolvedValue(null);
      progressRepository.create.mockReturnValue({
        ...mockProgress,
        status: OnboardingProgressStatus.SKIPPED,
      } as any);
      progressRepository.save.mockResolvedValue({
        ...mockProgress,
        status: OnboardingProgressStatus.SKIPPED,
      } as any);

      const result = await service.skipStep('user-1', 'step-1');

      expect(result.status).toBe(OnboardingProgressStatus.SKIPPED);
    });

    it('should throw BadRequestException when trying to skip required step', async () => {
      stepRepository.findOne.mockResolvedValue(mockStep as any);

      await expect(service.skipStep('user-1', 'step-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getNextIncompleteStep', () => {
    it('should return the next incomplete step', async () => {
      const steps = [
        mockStep,
        { ...mockStep, id: 'step-2', order: 2 },
      ];
      
      stepRepository.find.mockResolvedValue(steps as any);
      progressRepository.find.mockResolvedValue([
        { stepId: 'step-1', status: OnboardingProgressStatus.COMPLETED },
      ] as any);

      const result = await service.getNextIncompleteStep('user-1');

      expect(result.id).toBe('step-2');
    });

    it('should return null when all steps completed', async () => {
      const steps = [mockStep];
      
      stepRepository.find.mockResolvedValue(steps as any);
      progressRepository.find.mockResolvedValue([
        { stepId: 'step-1', status: OnboardingProgressStatus.COMPLETED },
      ] as any);

      const result = await service.getNextIncompleteStep('user-1');

      expect(result).toBeNull();
    });
  });

  describe('createReward', () => {
    it('should create a new reward', async () => {
      const createDto = {
        name: 'Completion Bonus',
        description: 'Awarded for completing all steps',
        type: RewardType.POINTS,
        requiredSteps: 5,
      };

      rewardRepository.create.mockReturnValue(mockReward as any);
      rewardRepository.save.mockResolvedValue(mockReward as any);

      const result = await service.createReward(createDto);

      expect(rewardRepository.create).toHaveBeenCalledWith(createDto);
      expect(rewardRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockReward);
    });
  });

  describe('findAllRewards', () => {
    it('should return all active rewards', async () => {
      const rewards = [mockReward];
      rewardRepository.find.mockResolvedValue(rewards as any);

      const result = await service.findAllRewards();

      expect(rewardRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { requiredSteps: 'ASC' },
      });
      expect(result).toEqual(rewards);
    });
  });
});
