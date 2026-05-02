import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Course } from './entities/course.entity';
import { UpdateCourseDto } from './dto/update-course.dto';
import {
  paginate,
  paginateWithCursor,
  IPaginatedResponse,
  ICursorPaginatedResponse,
} from '../common/utils/pagination.util';
import { CourseSearchDto, CursorCourseSearchDto } from './dto/course-search.dto';
import { CachingService } from '../caching/caching.service';
import { CacheInvalidationService } from '../caching/invalidation/invalidation.service';
import { CACHE_TTL, CACHE_PREFIXES, CACHE_EVENTS } from '../caching/caching.constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sanitizeSqlLike, enforceWhitelistedValue } from '../common/utils/sanitization.utils';
import { CourseModule } from './entities/course-module.entity';
import { Lesson } from './entities/lesson.entity';

/**
 * Provides course operations.
 */
@Injectable()
export class CoursesService {
    constructor(
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
    private readonly cachingService: CachingService,
    private readonly invalidationService: CacheInvalidationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new record.
   * @param createCourseDto The request payload.
   * @returns The resulting course.
   */
  async create(createCourseDto: any): Promise<Course> {
    const course = this.coursesRepository.create({
      ...createCourseDto,
      instructor: { id: createCourseDto.instructorId },
    });
    const saved = await this.coursesRepository.save(course);
    const result = Array.isArray(saved) ? saved[0] : saved;
    this.eventEmitter.emit(CACHE_EVENTS.COURSE_CREATED, { course: result });
    return result;
  }

  async findAll(filter?: CourseSearchDto): Promise<IPaginatedResponse<Course>> {
    const cacheKey = `${CACHE_PREFIXES.COURSES_LIST}:${JSON.stringify(filter || {})}`;

    return this.cachingService.getOrSet(
      cacheKey,
      async () => {
        const query = this.coursesRepository.createQueryBuilder('course');

        query.leftJoinAndSelect('course.instructor', 'instructor');

        if (filter?.search) {
          const safeSearch = sanitizeSqlLike(filter.search);
          query.andWhere(
            "(course.title ILIKE :search ESCAPE '\\' OR course.description ILIKE :search ESCAPE '\\')",
            { search: `%${safeSearch}%` },
          );
        }

        if (filter?.status) {
          const allowedStatuses = ['draft', 'published', 'archived'] as const;
          const status = enforceWhitelistedValue(filter.status, allowedStatuses, 'status');
          query.andWhere('course.status = :status', { status });
        }

        if (filter?.instructorId) {
          query.andWhere('course.instructorId = :instructorId', {
            instructorId: filter.instructorId,
          });
        }

        query.orderBy('course.createdAt', 'DESC');

        return await paginate(query, filter);
      },
      CACHE_TTL.COURSE_METADATA,
    );
  }

  /**
   * Retrieves all With Cursor.
   * @param filter The filter criteria.
   * @returns The resulting cursor paginated response<course>.
   */
  async findAllWithCursor(
    filter?: CursorCourseSearchDto,
  ): Promise<ICursorPaginatedResponse<Course>> {
    const cacheKey = `${CACHE_PREFIXES.COURSES_LIST}:cursor:${JSON.stringify(filter || {})}`;

    return this.cachingService.getOrSet(
      cacheKey,
      async () => {
        const query = this.coursesRepository.createQueryBuilder('course');

        query.leftJoinAndSelect('course.instructor', 'instructor');

        if (filter?.search) {
          query.andWhere('(course.title ILIKE :search OR course.description ILIKE :search)', {
            search: `%${filter.search}%`,
          });
        }

        if (filter?.status) {
          query.andWhere('course.status = :status', { status: filter.status });
        }

        if (filter?.instructorId) {
          query.andWhere('course.instructorId = :instructorId', {
            instructorId: filter.instructorId,
          });
        }

        if (filter?.minPrice !== undefined) {
          query.andWhere('course.price >= :minPrice', { minPrice: filter.minPrice });
        }

        if (filter?.maxPrice !== undefined) {
          query.andWhere('course.price <= :maxPrice', { maxPrice: filter.maxPrice });
        }

        return await paginateWithCursor(query, filter ?? {});
      },
      CACHE_TTL.COURSE_METADATA,
    );
  }

  /**
   * Retrieves records by their identifiers.
   * @param ids The identifiers.
   * @returns The matching results.
   */
  async findByIds(ids: string[]): Promise<Course[]> {
    if (ids.length === 0) return [];
    return await this.coursesRepository.findByIds(ids);
  }

  /**
   * Retrieves by Instructor.
   * @param instructorId The instructor identifier.
   * @returns The matching results.
   */
  async findByInstructor(instructorId: string): Promise<Course[]> {
    return await this.coursesRepository.find({
      where: { instructor: { id: instructorId } },
      relations: ['instructor'],
    });
  }

  /**
   * Retrieves by Instructor Ids.
   * @param instructorIds The instructor identifiers.
   * @returns The matching results.
   */
  async findByInstructorIds(instructorIds: string[]): Promise<Course[]> {
    if (instructorIds.length === 0) return [];
    return await this.coursesRepository
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.instructor', 'instructor')
      .where('instructor.id IN (:...instructorIds)', { instructorIds })
      .getMany();
  }

  /**
   * Retrieves the requested record.
   * @param id The identifier.
   * @returns The resulting course.
   */
  async findOne(id: string): Promise<Course> {
    const cacheKey = `${CACHE_PREFIXES.COURSE}:${id}`;

    return this.cachingService.getOrSet(
      cacheKey,
      async () => {
        const course = await this.coursesRepository.findOne({
            where: { id },
            relations: ['instructor', 'modules', 'modules.lessons'],
        });
        if (!course) {
            throw new NotFoundException(`Course with ID ${id} not found`);
        }
        return course;
      },
      CACHE_TTL.COURSE_DETAILS,
    );
  }

  /**
   * Updates the requested record.
   * @param id The identifier.
   * @param updateCourseDto The request payload.
   * @returns The resulting course.
   */
  async update(id: string, updateCourseDto: UpdateCourseDto): Promise<Course> {
    const course = await this.coursesRepository.findOne({
      where: { id },
      relations: ['instructor', 'modules', 'modules.lessons'],
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }
    Object.assign(course, updateCourseDto);
    const saved = await this.coursesRepository.save(course);

    // Invalidate cache after update
    this.eventEmitter.emit(CACHE_EVENTS.COURSE_UPDATED, { courseId: id });

    return saved;
  }

  /**
   * Removes the requested record.
   * @param id The identifier.
   */
  async remove(id: string): Promise<void> {
    const course = await this.coursesRepository.findOne({
      where: { id },
      relations: ['modules'],
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    await this.coursesRepository.manager.transaction(async (manager) => {
      const moduleIds = course.modules.map((module) => module.id);

      if (moduleIds.length > 0) {
        await manager.getRepository(Lesson).softDelete({ moduleId: In(moduleIds) });
      }

      await manager.getRepository(CourseModule).softDelete({ courseId: id });
      await manager.getRepository(Course).softDelete(id);
    });

    // Invalidate cache after delete
    this.eventEmitter.emit(CACHE_EVENTS.COURSE_DELETED, { courseId: id });
  }

  /**
   * Retrieves analytics.
   * @returns The operation result.
   */
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
