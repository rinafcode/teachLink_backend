import { Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../common/exceptions/app.exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseModule } from '../entities/course-module.entity';
import { CreateModuleDto } from '../dto/create-module.dto';
import { Course } from '../entities/course.entity';
import { Lesson } from '../entities/lesson.entity';

/**
 * Provides modules operations.
 */
@Injectable()
export class ModulesService {
  constructor(
    @InjectRepository(CourseModule)
    private modulesRepository: Repository<CourseModule>,
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
  ) {}

  /**
   * Creates a new record.
   * @param createModuleDto The request payload.
   * @returns The resulting course module.
   */
  async create(createModuleDto: CreateModuleDto): Promise<CourseModule> {
    const course = await this.coursesRepository.findOneBy({ id: createModuleDto.courseId });
    if (!course) {
      throw new ResourceNotFoundException('Course', createModuleDto.courseId);
    }

    const module = this.modulesRepository.create({
      ...createModuleDto,
      course,
    });
    return this.modulesRepository.save(module);
  }

  /**
   * Retrieves the requested record.
   * @param id The identifier.
   * @returns The resulting course module.
   */
  async findOne(id: string): Promise<CourseModule> {
    const module = await this.modulesRepository.findOne({
      where: { id },
      relations: ['lessons'],
      order: {
        lessons: {
          order: 'ASC',
        } as any,
      },
    });
    if (!module) {
      throw new ResourceNotFoundException('CourseModule', id);
    }
    return module;
  }

  /**
   * Updates the requested record.
   * @param id The identifier.
   * @param updateData The data to process.
   * @returns The resulting course module.
   */
  async update(id: string, updateData: Partial<CreateModuleDto>): Promise<CourseModule> {
    const module = await this.findOne(id);
    Object.assign(module, updateData);
    return this.modulesRepository.save(module);
  }

  /**
   * Removes the requested record.
   * @param id The identifier.
   */
  async remove(id: string): Promise<void> {
    const module = await this.findOne(id);
    await this.modulesRepository.manager.transaction(async (manager) => {
      await manager.getRepository(Lesson).softDelete({ moduleId: module.id });
      await manager.getRepository(CourseModule).softDelete(module.id);
    });
  }
}
