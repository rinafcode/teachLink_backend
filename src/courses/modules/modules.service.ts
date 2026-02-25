import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseModule } from '../entities/course-module.entity';
import { CreateModuleDto } from '../dto/create-module.dto';
import { Course } from '../entities/course.entity';

@Injectable()
export class ModulesService {
  constructor(
    @InjectRepository(CourseModule)
    private modulesRepository: Repository<CourseModule>,
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
  ) {}

  async create(createModuleDto: CreateModuleDto): Promise<CourseModule> {
    const course = await this.coursesRepository.findOneBy({ id: createModuleDto.courseId });
    if (!course) {
      throw new NotFoundException(`Course with ID ${createModuleDto.courseId} not found`);
    }

    const module = this.modulesRepository.create({
      ...createModuleDto,
      course,
    });
    return this.modulesRepository.save(module);
  }

  async findOne(id: string): Promise<CourseModule> {
    const module = await this.modulesRepository.findOne({
      where: { id },
      relations: ['lessons'],
      order: {
          lessons: {
              order: 'ASC'
          } as any
      }
    });
    if (!module) {
      throw new NotFoundException(`Module with ID ${id} not found`);
    }
    return module;
  }

  async update(id: string, updateData: Partial<CreateModuleDto>): Promise<CourseModule> {
    const module = await this.findOne(id);
    Object.assign(module, updateData);
    return this.modulesRepository.save(module);
  }

  async remove(id: string): Promise<void> {
    const module = await this.findOne(id);
    await this.modulesRepository.remove(module);
  }
}
