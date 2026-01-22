import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from '../entities/lesson.entity';
import { CreateLessonDto } from '../dto/create-lesson.dto';
import { CourseModule } from '../entities/course-module.entity';

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson)
    private lessonsRepository: Repository<Lesson>,
    @InjectRepository(CourseModule)
    private modulesRepository: Repository<CourseModule>,
  ) {}

  async create(createLessonDto: CreateLessonDto): Promise<Lesson> {
    const module = await this.modulesRepository.findOneBy({ id: createLessonDto.moduleId });
    if (!module) {
      throw new NotFoundException(`Module with ID ${createLessonDto.moduleId} not found`);
    }

    const lesson = this.lessonsRepository.create({
      ...createLessonDto,
      module,
    });
    return this.lessonsRepository.save(lesson);
  }

  async findOne(id: string): Promise<Lesson> {
    const lesson = await this.lessonsRepository.findOneBy({ id });
    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }
    return lesson;
  }

  async update(id: string, updateData: Partial<CreateLessonDto>): Promise<Lesson> {
    const lesson = await this.findOne(id);
    Object.assign(lesson, updateData);
    return this.lessonsRepository.save(lesson);
  }

  async remove(id: string): Promise<void> {
    const lesson = await this.findOne(id);
    await this.lessonsRepository.remove(lesson);
  }
}
