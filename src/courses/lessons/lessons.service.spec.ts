import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { Lesson } from '../entities/lesson.entity';
import { CourseModule } from '../entities/course-module.entity';

const mockLessonRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOneBy: jest.fn(),
  softDelete: jest.fn(),
};

const mockModuleRepo = {
  findOneBy: jest.fn(),
};

const baseModule = { id: 'mod-1', title: 'Module 1' };
const baseLesson: Partial<Lesson> = {
  id: 'lesson-1',
  title: 'Intro to JS',
  content: 'Content here',
  moduleId: 'mod-1',
  order: 1,
  durationSeconds: 300,
};

describe('LessonsService', () => {
  let service: LessonsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        { provide: getRepositoryToken(Lesson), useValue: mockLessonRepo },
        { provide: getRepositoryToken(CourseModule), useValue: mockModuleRepo },
      ],
    }).compile();

    service = module.get<LessonsService>(LessonsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a lesson when module exists', async () => {
      mockModuleRepo.findOneBy.mockResolvedValue(baseModule);
      mockLessonRepo.create.mockReturnValue(baseLesson);
      mockLessonRepo.save.mockResolvedValue(baseLesson);

      const dto = { title: 'Intro to JS', moduleId: 'mod-1' };
      const result = await service.create(dto as any);

      expect(mockModuleRepo.findOneBy).toHaveBeenCalledWith({ id: 'mod-1' });
      expect(mockLessonRepo.create).toHaveBeenCalledWith({ ...dto, module: baseModule });
      expect(result).toEqual(baseLesson);
    });

    it('should throw NotFoundException when module does not exist', async () => {
      mockModuleRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.create({ title: 'Lesson', moduleId: 'nonexistent' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return lesson when found', async () => {
      mockLessonRepo.findOneBy.mockResolvedValue(baseLesson);
      const result = await service.findOne('lesson-1');
      expect(result).toEqual(baseLesson);
      expect(mockLessonRepo.findOneBy).toHaveBeenCalledWith({ id: 'lesson-1' });
    });

    it('should throw NotFoundException when lesson not found', async () => {
      mockLessonRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return the lesson', async () => {
      const updated = { ...baseLesson, title: 'Updated Title' };
      mockLessonRepo.findOneBy.mockResolvedValue({ ...baseLesson });
      mockLessonRepo.save.mockResolvedValue(updated);

      const result = await service.update('lesson-1', { title: 'Updated Title' });
      expect(result.title).toBe('Updated Title');
    });

    it('should throw NotFoundException when lesson not found during update', async () => {
      mockLessonRepo.findOneBy.mockResolvedValue(null);
      await expect(service.update('nonexistent', { title: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft-delete the lesson', async () => {
      mockLessonRepo.findOneBy.mockResolvedValue(baseLesson);
      mockLessonRepo.softDelete.mockResolvedValue({ affected: 1 });

      await service.remove('lesson-1');

      expect(mockLessonRepo.softDelete).toHaveBeenCalledWith('lesson-1');
    });

    it('should throw NotFoundException when lesson not found during remove', async () => {
      mockLessonRepo.findOneBy.mockResolvedValue(null);
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
