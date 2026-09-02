import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OutboxService } from '../common/events/outbox.service';

import { Course, CourseStatus } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { User, PRIVILEGED_ROLES } from '../users/entities/user.entity';

import { CACHE_EVENTS } from '../caching/caching.constants';
import { APP_EVENTS } from '../common/constants/event.constants';
import { APP_CONSTANTS } from '../common/constants/app.constants';

/**
 * True when the error is a PostgreSQL unique-violation (23505). Used to treat
 * the database constraint as the authoritative "already enrolled" signal
 * instead of relying only on the application-level pre-check (issue #1343).
 */
function isUniqueViolation(err: unknown): boolean {
  const error = err as any;
  return (
    error?.code === '23505' ||
    error?.driverError?.code === '23505' ||
    (typeof error?.message === 'string' && error.message.includes('unique'))
  );
}

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  private static readonly DEFAULT_PAGE = 1;
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,

    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,

    private readonly outbox: OutboxService,

    private readonly dataSource: DataSource,
  ) {}

  /**
   * Enroll user into a course.
   */
  async enroll(userId: string, courseId: string): Promise<Enrollment> {
    return this.dataSource.transaction(async (manager) => {
      const enrollmentRepo = manager.getRepository(Enrollment);

      const courseRepo = manager.getRepository(Course);

      const course = await courseRepo.findOne({
        where: { id: courseId },
        relations: ['prerequisite'],
      });

      if (!course) {
        throw new NotFoundException(`Course ${courseId} not found`);
      }

      if (course.status !== CourseStatus.PUBLISHED) {
        throw new BadRequestException(`Cannot enroll in course with status "${course.status}".`);
      }

      const existing = await enrollmentRepo.findOne({
        where: {
          userId,
          courseId,
        },
      });

      if (existing) {
        throw new ConflictException('User is already enrolled in this course');
      }

      await this.validatePrerequisites(userId, course, enrollmentRepo);

      const enrollment = enrollmentRepo.create({
        userId,
        courseId,
        status: APP_CONSTANTS.ENROLLMENT_STATUS.ACTIVE,
        progress: 0,
      });

      let saved: Enrollment;
      try {
        saved = await enrollmentRepo.save(enrollment);
      } catch (error) {
        // The partial unique index (user_id, course_id) WHERE "deletedAt" IS NULL
        // is the authoritative guard: a concurrent request may have inserted the
        // same active enrollment between our pre-check and this save.
        if (isUniqueViolation(error)) {
          throw new ConflictException('User is already enrolled in this course');
        }
        throw error;
      }

      // Events are enlisted in the SAME transaction so a rollback never
      // leaves ghost cache entries or recommendation updates (issue #1221).
      await this.outbox.enqueue(manager, CACHE_EVENTS.ENROLLMENT_CREATED, { id: saved.id });
      await this.outbox.enqueue(manager, APP_EVENTS.COURSE_ENROLLED, {
        userId,
        courseId,
      });

      this.logger.log(`User ${userId} enrolled in course ${courseId}`);

      return saved;
    });
  }

  /**
   * Bulk enroll users.
   */
  async bulkEnroll(
    enrollments: { userId: string; courseId: string }[],
  ): Promise<{ enrolled: number; skipped: number; failed: number; errors: any[] }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let enrolledCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errors: any[] = [];
    const successfulEnrollments: any[] = [];

    try {
      const enrollmentRepo = queryRunner.manager.getRepository(Enrollment);
      const courseRepo = queryRunner.manager.getRepository(Course);

      for (const item of enrollments) {
        const { userId, courseId } = item;
        try {
          const course = await courseRepo.findOne({
            where: { id: courseId },
            relations: ['prerequisite'],
          });

          if (!course) {
            failedCount++;
            errors.push({ userId, courseId, error: `Course ${courseId} not found` });
            continue;
          }

          if (course.status !== CourseStatus.PUBLISHED) {
            failedCount++;
            errors.push({
              userId,
              courseId,
              error: `Cannot enroll in course with status "${course.status}".`,
            });
            continue;
          }

          const existing = await enrollmentRepo.findOne({
            where: { userId, courseId },
          });

          if (existing) {
            skippedCount++;
            errors.push({ userId, courseId, error: 'User is already enrolled in this course' });
            continue;
          }

          await this.validatePrerequisites(userId, course, enrollmentRepo);

          const enrollment = enrollmentRepo.create({
            userId,
            courseId,
            status: APP_CONSTANTS.ENROLLMENT_STATUS.ACTIVE,
            progress: 0,
          });

          const saved = await enrollmentRepo.save(enrollment);
          enrolledCount++;
          successfulEnrollments.push(saved);
        } catch (error) {
          failedCount++;
          errors.push({
            userId,
            courseId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (failedCount > 0) {
        await queryRunner.rollbackTransaction();
        enrolledCount = 0;
      } else {
        await queryRunner.commitTransaction();

        // Enqueue events for successful enrollments after commit (durable,
        // delivered at-least-once by the outbox relay — issue #1221).
        for (const saved of successfulEnrollments) {
          await this.outbox.enqueueStandalone(CACHE_EVENTS.ENROLLMENT_CREATED, {
            id: saved.id,
          });
          await this.outbox.enqueueStandalone(APP_EVENTS.COURSE_ENROLLED, {
            userId: saved.userId,
            courseId: saved.courseId,
          });
        }
        if (enrolledCount > 0) {
          this.logger.log(`Bulk enrolled ${enrolledCount} users successfully`);
        }
      }

      return { enrolled: enrolledCount, skipped: skippedCount, failed: failedCount, errors };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validate prerequisite completion.
   */
  private async validatePrerequisites(
    userId: string,
    course: Course,
    repo: Repository<Enrollment>,
  ): Promise<void> {
    if (!course.prerequisite) {
      return;
    }

    const prerequisite = await repo.findOne({
      where: {
        userId,
        courseId: course.prerequisite.id,
        status: APP_CONSTANTS.ENROLLMENT_STATUS.COMPLETED,
      },
    });

    if (!prerequisite) {
      throw new BadRequestException(
        `You must complete "${course.prerequisite.title}" before enrolling in "${course.title}".`,
      );
    }
  }

  /**
   * Get user enrollments.
   */
  async getUserEnrollments(
    userId: string,
    page = EnrollmentsService.DEFAULT_PAGE,
    limit = EnrollmentsService.DEFAULT_LIMIT,
  ): Promise<Enrollment[]> {
    const take = Math.min(limit, EnrollmentsService.MAX_LIMIT);

    return this.enrollmentRepo.find({
      where: { userId },
      relations: ['course', 'course.instructor'],
      order: {
        enrolledAt: 'DESC',
      },
      skip: (page - 1) * take,
      take,
    });
  }

  /**
   * Get enrollment by id.
   */
  async findOne(id: string, userId: string): Promise<Enrollment> {
    const enrollment = await this.enrollmentRepo.findOne({
      where: { id },
      relations: ['course', 'course.instructor', 'course.prerequisite'],
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${id} not found`);
    }

    if (enrollment.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view this enrollment');
    }

    return enrollment;
  }

  /**
   * Update progress.
   */
  async updateProgress(id: string, progress: number, userId: string): Promise<Enrollment> {
    const enrollment = await this.findOne(id, userId);

    this.validateProgress(progress);

    if (progress < enrollment.progress) {
      throw new BadRequestException('Progress cannot decrease');
    }

    const alreadyCompleted = enrollment.status === APP_CONSTANTS.ENROLLMENT_STATUS.COMPLETED;

    enrollment.progress = progress;

    const wasCompleted = !alreadyCompleted && progress === 100;
    if (wasCompleted) {
      enrollment.status = APP_CONSTANTS.ENROLLMENT_STATUS.COMPLETED;
    }

    const saved = await this.enrollmentRepo.save(enrollment);

    // Enqueue after the write so a failed save never produces a ghost event.
    if (wasCompleted) {
      await this.outbox.enqueueStandalone(APP_EVENTS.COURSE_COMPLETED, {
        userId: enrollment.userId,
        courseId: enrollment.courseId,
      });
    }
    await this.outbox.enqueueStandalone(CACHE_EVENTS.ENROLLMENT_UPDATED, {
      id: saved.id,
    });

    this.logger.log(`Progress updated for enrollment ${id}: ${progress}%`);

    return saved;
  }

  /**
   * Unenroll user.
   */
  async unenroll(userId: string, courseId: string): Promise<void> {
    const enrollment = await this.enrollmentRepo.findOne({
      where: {
        userId,
        courseId,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    await this.enrollmentRepo.remove(enrollment);

    await this.outbox.enqueueStandalone(CACHE_EVENTS.ENROLLMENT_UPDATED, {
      id: enrollment.id,
    });
    await this.outbox.enqueueStandalone(APP_EVENTS.COURSE_UNENROLLED, {
      userId,
      courseId,
    });

    this.logger.log(`User ${userId} unenrolled from course ${courseId}`);
  }

  /**
   * Get enrollments for a course.
   */
  async getCourseEnrollments(
    courseId: string,
    requestingUser: User,
    page = EnrollmentsService.DEFAULT_PAGE,
    limit = EnrollmentsService.DEFAULT_LIMIT,
  ): Promise<Enrollment[]> {
    const course = await this.courseRepo.findOne({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    this.assertInstructorOrAdmin(course, requestingUser);

    const take = Math.min(limit, EnrollmentsService.MAX_LIMIT);

    return this.enrollmentRepo.find({
      where: { courseId },
      relations: ['user'],
      order: {
        enrolledAt: 'DESC',
      },
      skip: (page - 1) * take,
      take,
    });
  }

  /**
   * Validate progress value.
   */
  private validateProgress(progress: number): void {
    if (progress < 0 || progress > 100) {
      throw new BadRequestException('Progress must be between 0 and 100');
    }
  }

  /**
   * Check admin/moderator role.
   */
  private isPrivileged(user: User): boolean {
    return user.hasRole(...PRIVILEGED_ROLES);
  }

  /**
   * Ensure instructor or admin access.
   */
  private assertInstructorOrAdmin(course: Course, user: User): void {
    const allowed = course.instructorId === user.id || this.isPrivileged(user);

    if (!allowed) {
      throw new ForbiddenException(
        'Only the course instructor or admins can view course enrollments',
      );
    }
  }
}
