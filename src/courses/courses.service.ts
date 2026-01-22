import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from './entities/course.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseSearchDto } from './dto/course-search.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
  ) {}

  async create(createCourseDto: CreateCourseDto, user: User): Promise<Course> {
    const course = this.coursesRepository.create({
      ...createCourseDto,
      instructor: user,
    });
    return this.coursesRepository.save(course);
  }

  async findAll(searchDto: CourseSearchDto): Promise<{ data: Course[]; total: number }> {
    const { search, minPrice, maxPrice, status, page = 1, limit = 10 } = searchDto;
    const query = this.coursesRepository.createQueryBuilder('course');
    
    query.leftJoinAndSelect('course.instructor', 'instructor');

    if (search) {
      query.andWhere('(course.title ILIKE :search OR course.description ILIKE :search)', { search: `%${search}%` });
    }

    if (minPrice !== undefined) {
      query.andWhere('course.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      query.andWhere('course.price <= :maxPrice', { maxPrice });
    }

    if (status) {
      query.andWhere('course.status = :status', { status });
    }

    query.skip((page - 1) * limit).take(limit);
    query.orderBy('course.createdAt', 'DESC');

    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }

  async findOne(id: string): Promise<Course> {
    const course = await this.coursesRepository.findOne({
      where: { id },
      relations: ['instructor', 'modules', 'modules.lessons'],
      order: {
        modules: {
            order: 'ASC',
            lessons: {
                order: 'ASC'
            }
        } as any
      }
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
      const publishedCourses = await this.coursesRepository.count({ where: { status: 'published' } });
      
      const { totalEnrollments } = await this.coursesRepository
        .createQueryBuilder('course')
        .leftJoin('course.enrollments', 'enrollment')
        .select('COUNT(enrollment.id)', 'totalEnrollments')
        .getRawOne();

      return {
          totalCourses,
          publishedCourses,
          totalEnrollments: parseInt(totalEnrollments) || 0
      };
  }
}
