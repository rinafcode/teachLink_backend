import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { LessonsService } from './lessons.service';
import { Lesson } from '../entities/lesson.entity';
import { CourseModule } from '../entities/course-module.entity';

describe('LessonsService', () => {
  let service: LessonsService;

  const lessonRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOneBy: jest.fn(),
    softDelete: jest.fn(),
  };

  const moduleRepo = {
    findOneBy: jest.fn(),
  };

  const createModule = (): Partial<CourseModule> => ({
    id: 'mod-1',
    title: 'Module 1',
  });

  const createLesson = (): Partial<Lesson> => ({
    id: 'lesson-1',
    title: 'Intro to JS',
    content: 'Lesson content',
    moduleId: 'mod-1',
    order: 1,
    durationSeconds: 300,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        {
          provide: getRepositoryToken(Lesson),
          useValue: lessonRepo,
        },
        {
          provide: getRepositoryToken(CourseModule),
          useValue: moduleRepo,
        },
      ],
    }).compile();

    service = module.get(LessonsService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create()', () => {
    it('should create a lesson when module exists', async () => {
      const module = createModule();
      const lesson = createLesson();

      moduleRepo.findOneBy.mockResolvedValue(module);
      lessonRepo.create.mockReturnValue(lesson);
      lessonRepo.save.mockResolvedValue(lesson);

      const dto = {
        title: 'Intro to JS',
        moduleId: 'mod-1',
      };

      const result = await service.create(dto as any);

      expect(moduleRepo.findOneBy).toHaveBeenCalledWith({
        id: dto.moduleId,
      });

      expect(lessonRepo.create).toHaveBeenCalledWith({
        ...dto,
        module,
      });

      expect(lessonRepo.save).toHaveBeenCalledWith(lesson);

      expect(result).toEqual(lesson);
    });

    it('should throw NotFoundException when module does not exist', async () => {
      moduleRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.create({
          title: 'Test',
          moduleId: 'missing-module',
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should propagate repository save errors', async () => {
      const module = createModule();

      moduleRepo.findOneBy.mockResolvedValue(module);
      lessonRepo.create.mockReturnValue(createLesson());
      lessonRepo.save.mockRejectedValue(
        new Error('Database write failed'),
      );

      await expect(
        service.create({
          title: 'Test',
          moduleId: 'mod-1',
        } as any),
      ).rejects.toThrow('Database write failed');
    });
  });

  describe('findOne()', () => {
    it('should return a lesson when found', async () => {
      const lesson = createLesson();

      lessonRepo.findOneBy.mockResolvedValue(lesson);

      const result = await service.findOne('lesson-1');

      expect(lessonRepo.findOneBy).toHaveBeenCalledWith({
        id: 'lesson-1',
      });

      expect(result).toEqual(lesson);
    });

    it('should throw NotFoundException when lesson does not exist', async () => {
      lessonRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.findOne('missing-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update()', () => {
    it('should update and save lesson changes', async () => {
      const lesson = createLesson();

      lessonRepo.findOneBy.mockResolvedValue(lesson);

      lessonRepo.save.mockResolvedValue({
        ...lesson,
        title: 'Updated Lesson',
      });

      const result = await service.update('lesson-1', {
        title: 'Updated Lesson',
      });

      expect(lessonRepo.save).toHaveBeenCalled();

      expect(result.title).toBe('Updated Lesson');
    });

    it('should throw NotFoundException when updating missing lesson', async () => {
      lessonRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('missing-id', {
          title: 'Updated',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should propagate save failures during update', async () => {
      lessonRepo.findOneBy.mockResolvedValue(createLesson());

      lessonRepo.save.mockRejectedValue(
        new Error('Update failed'),
      );

      await expect(
        service.update('lesson-1', {
          title: 'Updated',
        }),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('remove()', () => {
    it('should soft delete an existing lesson', async () => {
      lessonRepo.findOneBy.mockResolvedValue(createLesson());

      lessonRepo.softDelete.mockResolvedValue({
        affected: 1,
      });

      await service.remove('lesson-1');

      expect(lessonRepo.softDelete).toHaveBeenCalledWith(
        'lesson-1',
      );
    });

    it('should throw NotFoundException when lesson does not exist', async () => {
      lessonRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.remove('missing-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should propagate soft delete errors', async () => {
      lessonRepo.findOneBy.mockResolvedValue(createLesson());

      lessonRepo.softDelete.mockRejectedValue(
        new Error('Delete failed'),
      );

      await expect(
        service.remove('lesson-1'),
      ).rejects.toThrow('Delete failed');
    });
  });
});