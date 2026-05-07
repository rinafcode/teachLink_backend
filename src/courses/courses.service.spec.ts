import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CoursesService } from './courses.service';
import { Course } from './entities/course.entity';
import { CachingService } from '../caching/caching.service';
import { CacheInvalidationService } from '../caching/invalidation/invalidation.service';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  findByIds: jest.fn(),
  count: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn(),
  manager: {
    transaction: jest.fn(),
    getRepository: jest.fn(),
  },
});

const mockCaching = () => ({
  getOrSet: jest.fn().mockImplementation((_key: string, fn: () => any) => fn()),
  invalidate: jest.fn().mockResolvedValue(undefined),
});

const mockInvalidation = () => ({
  invalidateByPattern: jest.fn().mockResolvedValue(undefined),
  invalidate: jest.fn().mockResolvedValue(undefined),
});

describe('CoursesService', () => {
  let service: CoursesService;
  let repo: ReturnType<typeof mockRepo>;
  let caching: ReturnType<typeof mockCaching>;
  let emitter: { emit: jest.Mock };

  beforeEach(async () => {
    repo = mockRepo();
    caching = mockCaching();
    emitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: getRepositoryToken(Course), useValue: repo },
        { provide: CachingService, useValue: caching },
        { provide: CacheInvalidationService, useValue: mockInvalidation() },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  afterEach(() => jest.clearAllMocks());

  // â”€â”€â”€ create â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('create', () => {
    it('creates and returns a course', async () => {
      const dto = { title: 'NestJS Basics', instructorId: 'inst-1' };
      const entity = { id: 'c1', title: 'NestJS Basics', instructor: { id: 'inst-1' } };
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.create(dto);
      expect(repo.create).toHaveBeenCalledWith({
        ...dto,
        instructor: { id: 'inst-1' },
      });
      expect(repo.save).toHaveBeenCalledWith(entity);
      expect(emitter.emit).toHaveBeenCalled();
      expect(result).toEqual(entity);
    });
  });

  // â”€â”€â”€ findOne â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('findOne', () => {
    it('returns a course when found', async () => {
      const entity = { id: 'c1', title: 'Course 1', modules: [] };
      repo.findOne.mockResolvedValue(entity);

      const result = await service.findOne('c1');
      expect(result).toEqual(entity);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'c1' },
        relations: ['instructor', 'modules', 'modules.lessons'],
      });
    });

    it('throws NotFoundException when course does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // â”€â”€â”€ findByIds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('findByIds', () => {
    it('returns empty array for empty input', async () => {
      const result = await service.findByIds([]);
      expect(result).toEqual([]);
      expect(repo.findByIds).not.toHaveBeenCalled();
    });

    it('delegates to repository for non-empty ids', async () => {
      const courses = [{ id: 'c1' }, { id: 'c2' }];
      repo.findByIds.mockResolvedValue(courses);
      const result = await service.findByIds(['c1', 'c2']);
      expect(result).toEqual(courses);
    });
  });

  // â”€â”€â”€ update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('update', () => {
    it('throws NotFoundException when course does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', { title: 'New' })).rejects.toThrow(NotFoundException);
    });

    it('updates and returns the course', async () => {
      const entity = { id: 'c1', title: 'Old', modules: [] };
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockResolvedValue({ ...entity, title: 'New' });

      const result = await service.update('c1', { title: 'New' });
      expect(result.title).toBe('New');
      expect(emitter.emit).toHaveBeenCalled();
    });
  });

  // â”€â”€â”€ remove â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('remove', () => {
    it('throws NotFoundException when course does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('runs a transaction and emits event', async () => {
      const entity = { id: 'c1', modules: [] };
      repo.findOne.mockResolvedValue(entity);
      repo.manager.transaction.mockImplementation(async (fn: any) => fn(repo.manager));
      repo.manager.getRepository.mockReturnValue({ softDelete: jest.fn().mockResolvedValue(undefined) });

      await service.remove('c1');
      expect(repo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(emitter.emit).toHaveBeenCalled();
    });
  });

  // â”€â”€â”€ getAnalytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('getAnalytics', () => {
    it('returns aggregated analytics', async () => {
      repo.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(6);

      const qb: any = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalEnrollments: '42' }),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getAnalytics();
      expect(result).toEqual({ totalCourses: 10, publishedCourses: 6, totalEnrollments: 42 });
    });
  });
});