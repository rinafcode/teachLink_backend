import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from './entities/course.entity';
import { UpdateCourseDto } from './dto/update-course.dto';
import { paginate, PaginatedResponse } from '../common/utils/pagination.util';
import { CourseSearchDto } from './dto/course-search.dto';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
  ) {}

  async create(createCourseDto: any): Promise<Course> {
    const course = this.coursesRepository.create({
      ...createCourseDto,
      instructor: { id: createCourseDto.instructorId },
    });
    const saved = await this.coursesRepository.save(course);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async findAll(filter?: CourseSearchDto): Promise<PaginatedResponse<Course>> {
    const query = this.coursesRepository.createQueryBuilder('course');

    query.leftJoinAndSelect('course.instructor', 'instructor');

    if (filter?.search) {
      query.andWhere(
        '(course.title ILIKE :search OR course.description ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    if (filter?.status) {
      query.andWhere('course.status = :status', { status: filter.status });
    }

    if (filter?.instructorId) {
      query.andWhere('course.instructorId = :instructorId', {
        instructorId: filter.instructorId,
      });
    }

    query.orderBy('course.createdAt', 'DESC');

    return await paginate(query, filter);
  }

  async findByIds(ids: string[]): Promise<Course[]> {
    if (ids.length === 0) return [];
    return await this.coursesRepository.findByIds(ids);
  }

  async findByInstructor(instructorId: string): Promise<Course[]> {
    return await this.coursesRepository.find({
      where: { instructor: { id: instructorId } },
      relations: ['instructor'],
    });
  }

  async findByInstructorIds(instructorIds: string[]): Promise<Course[]> {
    if (instructorIds.length === 0) return [];
    return await this.coursesRepository
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.instructor', 'instructor')
      .where('instructor.id IN (:...instructorIds)', { instructorIds })
      .getMany();
  }

  async findOne(id: string): Promise<Course> {
    const course = await this.coursesRepository.findOne({
      where: { id },
      relations: ['instructor', 'modules', 'modules.lessons'],
      order: {
        modules: {
          order: 'ASC',
          lessons: {
            order: 'ASC',
          },
        } as any,
      },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }
    return course;
  }

  async update(id: string, updateCourseDto: UpdateCourseDto): Promise<Course> {
    const course = await this.findOne(id);
    Object.assign(course, updateCourseDto);
    return this.coursesRepository.save(course);
  }

  async remove(id: string): Promise<void> {
    const course = await this.findOne(id);
    await this.coursesRepository.remove(course);
  }

  async getAnalytics(): Promise<any> {
    const totalCourses = await this.coursesRepository.count();
    const publishedCourses = await this.coursesRepository.count({
      where: { status: 'published' },
    });

    const { totalEnrollments } = await this.coursesRepository
      .createQueryBuilder('course')
      .leftJoin('course.enrollments', 'enrollment')
      .select('COUNT(enrollment.id)', 'totalEnrollments')
      .getRawOne();

    return {
      totalCourses,
      publishedCourses,
      totalEnrollments: parseInt(totalEnrollments) || 0,
    };
  }
}
