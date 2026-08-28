import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RubricsService } from './rubrics.service';
import { Rubric } from './entities/rubric.entity';
import { RubricCriterion } from './entities/rubric-criterion.entity';
import { RubricLevel } from './entities/rubric-level.entity';

describe('RubricsService', () => {
  let service: RubricsService;
  let rubricRepo: jest.Mocked<Repository<Rubric>>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RubricsService,
        {
          provide: getRepositoryToken(Rubric),
          useValue: {
            findAndCount: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RubricCriterion),
          useValue: {},
        },
        {
          provide: getRepositoryToken(RubricLevel),
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RubricsService>(RubricsService);
    rubricRepo = module.get(getRepositoryToken(Rubric));
    dataSource = module.get(DataSource);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    let mockTxManager: any;
    let mockTxRubricRepo: any;
    let mockTxCriterionRepo: any;
    let mockTxLevelRepo: any;

    beforeEach(() => {
      mockTxRubricRepo = {
        create: jest.fn((dto) => ({ ...dto })),
        save: jest.fn(async (v) => { v.id = 'r1'; return v; }),
        findOne: jest.fn(),
      };
      mockTxCriterionRepo = {
        create: jest.fn((dto) => ({ ...dto })),
        save: jest.fn(async (v) => { v.id = 'c1'; return v; }),
      };
      mockTxLevelRepo = {
        create: jest.fn((dto) => ({ ...dto })),
        save: jest.fn(async (v) => { v.id = 'l1'; return v; }),
      };

      mockTxManager = {
        getRepository: jest.fn((entity) => {
          if (entity === Rubric) return mockTxRubricRepo;
          if (entity === RubricCriterion) return mockTxCriterionRepo;
          if (entity === RubricLevel) return mockTxLevelRepo;
        }),
      };

      dataSource.transaction.mockImplementation(async (cb: any) => cb(mockTxManager));
    });

    it('creates a rubric with criteria and levels successfully', async () => {
      const dto = {
        name: 'My Rubric',
        description: 'Desc',
        assessmentId: 'a1',
        criteria: [
          {
            title: 'Crit1',
            description: 'cDesc',
            maxPoints: 10,
            levels: [
              { label: 'L1', points: 10 },
              { label: 'L2', points: 5 },
            ],
          },
        ],
      };

      const finalRubric = { id: 'r1', criteria: [] };
      mockTxRubricRepo.findOne.mockResolvedValue(finalRubric);

      const result = await service.create(dto, 'owner-1');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(mockTxRubricRepo.save).toHaveBeenCalled();
      expect(mockTxCriterionRepo.save).toHaveBeenCalled();
      expect(mockTxLevelRepo.save).toHaveBeenCalled();
      expect(result).toEqual(finalRubric);
    });

    it('sets autoGradeEnabled to true if all criteria have a defaultLevelIndex', async () => {
      const dto = {
        name: 'Auto Rubric',
        autoGradeEnabled: true,
        criteria: [
          {
            title: 'C1',
            maxPoints: 10,
            defaultLevelIndex: 0,
            levels: [{ label: 'L1', points: 10 }],
          },
        ],
      };

      const finalRubric = { id: 'r1', autoGradeEnabled: true, criteria: [] };
      mockTxRubricRepo.findOne.mockResolvedValue(finalRubric);

      const result = await service.create(dto);
      expect(result.autoGradeEnabled).toBe(true);
      expect(mockTxRubricRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ autoGradeEnabled: true })
      );
    });

    it('throws BadRequestException if autoGradeEnabled=true but missing defaultLevelIndex', async () => {
      const dto = {
        name: 'Auto Rubric',
        autoGradeEnabled: true,
        criteria: [
          {
            title: 'C1',
            maxPoints: 10,
            levels: [{ label: 'L1', points: 10 }],
          },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if defaultLevelIndex is out of range', async () => {
      const dto = {
        name: 'Rubric',
        criteria: [
          {
            title: 'C1',
            maxPoints: 10,
            defaultLevelIndex: 5,
            levels: [{ label: 'L1', points: 10 }],
          },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if criterion has no levels', async () => {
      const dto = {
        name: 'Rubric',
        criteria: [
          {
            title: 'C1',
            maxPoints: 10,
            levels: [],
          },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if maxPoints is less than max level points', async () => {
      const dto = {
        name: 'Rubric',
        criteria: [
          {
            title: 'C1',
            maxPoints: 5,
            levels: [{ label: 'L1', points: 10 }],
          },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('returns the rubric when found and sorts criteria/levels', async () => {
      const rubric = {
        id: 'r1',
        criteria: [
          { id: 'c2', orderIndex: 2, levels: [{ id: 'l2', orderIndex: 2 }, { id: 'l1', orderIndex: 1 }] },
          { id: 'c1', orderIndex: 1, levels: [] },
        ],
      } as unknown as Rubric;
      rubricRepo.findOne.mockResolvedValue(rubric);

      const result = await service.findOne('r1');
      expect(result.criteria?.[0].id).toBe('c1');
      expect(result.criteria?.[1].id).toBe('c2');
      expect(result.criteria?.[1].levels?.[0].id).toBe('l1');
    });

    it('throws NotFoundException when missing', async () => {
      rubricRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('paginates and scopes by owner when provided', async () => {
      const rubrics = [{ id: 'r1' }] as Rubric[];
      rubricRepo.findAndCount.mockResolvedValue([rubrics, 1]);

      const result = await service.findAll('owner-1', 1, 10);

      expect(rubricRepo.findAndCount).toHaveBeenCalledWith({
        where: { ownerId: 'owner-1' },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result.data).toBe(rubrics);
      expect(result.totalPages).toBe(1);
    });

    it('does not scope by owner when omitted', async () => {
      rubricRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.findAll();
      expect(rubricRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  describe('update', () => {
    it('applies provided fields and saves', async () => {
      const rubric = { id: 'r1', name: 'old', autoGradeEnabled: false } as Rubric;
      rubricRepo.findOne.mockResolvedValue(rubric);
      rubricRepo.save.mockImplementation(async (v) => v as Rubric);

      await service.update('r1', { name: 'new' });
      expect(rubricRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'new' }));
    });

    it('throws ForbiddenException when requester is not the owner', async () => {
      const rubric = { id: 'r1', ownerId: 'owner-1' } as Rubric;
      rubricRepo.findOne.mockResolvedValue(rubric);
      await expect(service.update('r1', { name: 'new' }, 'someone-else')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when enabling autoGrade but missing default level on criteria', async () => {
      const rubric = {
        id: 'r1',
        ownerId: 'owner-1',
        criteria: [{ id: 'c1', defaultLevelId: null }],
      } as unknown as Rubric;
      rubricRepo.findOne.mockResolvedValue(rubric);

      await expect(service.update('r1', { autoGradeEnabled: true }, 'owner-1')).rejects.toThrow(BadRequestException);
    });

    it('enables autoGrade if all criteria have default level', async () => {
      const rubric = {
        id: 'r1',
        ownerId: 'owner-1',
        criteria: [{ id: 'c1', defaultLevelId: 'l1' }],
      } as unknown as Rubric;
      rubricRepo.findOne.mockResolvedValue(rubric);

      await service.update('r1', { autoGradeEnabled: true }, 'owner-1');
      expect(rubricRepo.save).toHaveBeenCalledWith(expect.objectContaining({ autoGradeEnabled: true }));
    });
  });

  describe('remove', () => {
    it('soft-deletes the rubric', async () => {
      const rubric = { id: 'r1', ownerId: 'owner-1' } as Rubric;
      rubricRepo.findOne.mockResolvedValue(rubric);

      await service.remove('r1', 'owner-1');
      expect(rubricRepo.softDelete).toHaveBeenCalledWith('r1');
    });

    it('throws ForbiddenException when requester is not the owner', async () => {
      const rubric = { id: 'r1', ownerId: 'owner-1' } as Rubric;
      rubricRepo.findOne.mockResolvedValue(rubric);
      await expect(service.remove('r1', 'someone-else')).rejects.toThrow(ForbiddenException);
    });
  });
});
