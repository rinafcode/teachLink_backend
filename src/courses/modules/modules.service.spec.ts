import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ResourceNotFoundException } from '../../common/exceptions/app.exceptions';
import { CourseModule } from '../entities/course-module.entity';
import { Course } from '../entities/course.entity';
import { Lesson } from '../entities/lesson.entity';
import { ModulesService } from './modules.service';

describe('ModulesService', () => {
  let service: ModulesService;

  const modulesRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    softDelete: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };

  const coursesRepo = {
    findOneBy: jest.fn(),
  };

  const lessonRepo = {
    softDelete: jest.fn(),
  };

  const transactionManager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Lesson) return lessonRepo;
      if (entity === CourseModule) return modulesRepo;
      return null;
    }),
  };

  beforeEach(async () => {
    modulesRepo.manager.transaction.mockImplementation(async (cb: any) => cb(transactionManager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModulesService,
        { provide: getRepositoryToken(CourseModule), useValue: modulesRepo },
        { provide: getRepositoryToken(Course), useValue: coursesRepo },
      ],
    }).compile();

    service = module.get(ModulesService);
    jest.clearAllMocks();
  });

  it('create saves a module when the course exists', async () => {
    const course = { id: 'course-1' };
    const moduleEntity = { id: 'module-1', course };

    coursesRepo.findOneBy.mockResolvedValue(course);
    modulesRepo.create.mockReturnValue(moduleEntity);
    modulesRepo.save.mockResolvedValue(moduleEntity);

    const result = await service.create({
      courseId: 'course-1',
      title: 'Module 1',
    } as any);

    expect(coursesRepo.findOneBy).toHaveBeenCalledWith({ id: 'course-1' });
    expect(modulesRepo.create).toHaveBeenCalledWith({
      courseId: 'course-1',
      title: 'Module 1',
      course,
    });
    expect(result).toBe(moduleEntity);
  });

  it('create throws when the course is missing', async () => {
    coursesRepo.findOneBy.mockResolvedValue(null);

    await expect(
      service.create({
        courseId: 'missing-course',
        title: 'Module 1',
      } as any),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it('findOne returns a module with lessons', async () => {
    const moduleEntity = { id: 'module-1', lessons: [] };

    modulesRepo.findOne.mockResolvedValue(moduleEntity);

    const result = await service.findOne('module-1');

    expect(modulesRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'module-1' },
      relations: ['lessons'],
      order: { lessons: { order: 'ASC' } },
    });
    expect(result).toBe(moduleEntity);
  });

  it('findOne throws when the module is missing', async () => {
    modulesRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne('missing-module')).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('update merges changes into the existing module', async () => {
    const moduleEntity = { id: 'module-1', title: 'Original', courseId: 'course-1' };

    modulesRepo.findOne.mockResolvedValue(moduleEntity);
    modulesRepo.save.mockResolvedValue({ ...moduleEntity, title: 'Updated' });

    const result = await service.update('module-1', { title: 'Updated' });

    expect(modulesRepo.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated' }));
    expect(result.title).toBe('Updated');
  });

  it('remove soft-deletes the module and its lessons in a transaction', async () => {
    modulesRepo.findOne.mockResolvedValue({ id: 'module-1' });

    await service.remove('module-1');

    expect(transactionManager.getRepository).toHaveBeenCalledWith(Lesson);
    expect(transactionManager.getRepository).toHaveBeenCalledWith(CourseModule);
    expect(lessonRepo.softDelete).toHaveBeenCalledWith({ moduleId: 'module-1' });
    expect(modulesRepo.softDelete).toHaveBeenCalledWith('module-1');
  });
});
