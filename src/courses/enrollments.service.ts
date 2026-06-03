import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  Repository,
} from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Course, CourseStatus } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { User, UserRole } from '../users/entities/user.entity';

import { CACHE_EVENTS } from '../caching/caching.constants';
import { APP_EVENTS } from '../common/constants/event.constants';
import { APP_CONSTANTS } from '../common/constants/app.constants';

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(
    EnrollmentsService.name,
  );

  private static readonly DEFAULT_PAGE = 1;
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,

    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,

    private readonly eventEmitter: EventEmitter2,

    private readonly dataSource: DataSource,
  ) {}

  /**
   * Enroll user into a course.
   */
  async enroll(
    userId: string,
    courseId: string,
  ): Promise<Enrollment> {
    return this.dataSource.transaction(
      async manager => {
        const enrollmentRepo =
          manager.getRepository(Enrollment);

        const courseRepo =
          manager.getRepository(Course);

        const course =
          await courseRepo.findOne({
            where: { id: courseId },
            relations: ['prerequisite'],
          });

        if (!course) {
          throw new NotFoundException(
            `Course ${courseId} not found`,
          );
        }

        if (
          course.status !==
          CourseStatus.PUBLISHED
        ) {
          throw new BadRequestException(
            `Cannot enroll in course with status "${course.status}".`,
          );
        }

        const existing =
          await enrollmentRepo.findOne({
            where: {
              userId,
              courseId,
            },
          });

        if (existing) {
          throw new BadRequestException(
            'User is already enrolled in this course',
          );
        }

        await this.validatePrerequisites(
          userId,
          course,
          enrollmentRepo,
        );

        const enrollment =
          enrollmentRepo.create({
            userId,
            courseId,
            status:
              APP_CONSTANTS
                .ENROLLMENT_STATUS.ACTIVE,
            progress: 0,
          });

        const saved =
          await enrollmentRepo.save(
            enrollment,
          );

        this.eventEmitter.emit(
          CACHE_EVENTS.ENROLLMENT_CREATED,
          { id: saved.id },
        );

        this.eventEmitter.emit(
          APP_EVENTS.COURSE_ENROLLED,
          {
            userId,
            courseId,
          },
        );

        this.logger.log(
          `User ${userId} enrolled in course ${courseId}`,
        );

        return saved;
      },
    );
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

    const prerequisite =
      await repo.findOne({
        where: {
          userId,
          courseId:
            course.prerequisite.id,
          status:
            APP_CONSTANTS
              .ENROLLMENT_STATUS
              .COMPLETED,
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
    const take = Math.min(
      limit,
      EnrollmentsService.MAX_LIMIT,
    );

    return this.enrollmentRepo.find({
      where: { userId },
      relations: [
        'course',
        'course.instructor',
      ],
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
  async findOne(
    id: string,
    userId: string,
  ): Promise<Enrollment> {
    const enrollment =
      await this.enrollmentRepo.findOne({
        where: { id },
        relations: [
          'course',
          'course.instructor',
          'course.prerequisite',
        ],
      });

    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment ${id} not found`,
      );
    }

    if (
      enrollment.userId !== userId
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this enrollment',
      );
    }

    return enrollment;
  }

  /**
   * Update progress.
   */
  async updateProgress(
    id: string,
    progress: number,
    userId: string,
  ): Promise<Enrollment> {
    const enrollment =
      await this.findOne(id, userId);

    this.validateProgress(progress);

    if (
      progress <
      enrollment.progress
    ) {
      throw new BadRequestException(
        'Progress cannot decrease',
      );
    }

    const alreadyCompleted =
      enrollment.status ===
      APP_CONSTANTS
        .ENROLLMENT_STATUS
        .COMPLETED;

    enrollment.progress = progress;

    if (
      progress === 100 &&
      !alreadyCompleted
    ) {
      enrollment.status =
        APP_CONSTANTS
          .ENROLLMENT_STATUS
          .COMPLETED;

      this.eventEmitter.emit(
        APP_EVENTS.COURSE_COMPLETED,
        {
          userId:
            enrollment.userId,
          courseId:
            enrollment.courseId,
        },
      );
    }

    const saved =
      await this.enrollmentRepo.save(
        enrollment,
      );

    this.eventEmitter.emit(
      CACHE_EVENTS.ENROLLMENT_UPDATED,
      {
        id: saved.id,
      },
    );

    this.logger.log(
      `Progress updated for enrollment ${id}: ${progress}%`,
    );

    return saved;
  }

  /**
   * Unenroll user.
   */
  async unenroll(
    userId: string,
    courseId: string,
  ): Promise<void> {
    const enrollment =
      await this.enrollmentRepo.findOne({
        where: {
          userId,
          courseId,
        },
      });

    if (!enrollment) {
      throw new NotFoundException(
        'Enrollment not found',
      );
    }

    await this.enrollmentRepo.remove(
      enrollment,
    );

    this.eventEmitter.emit(
      CACHE_EVENTS.ENROLLMENT_UPDATED,
      {
        id: enrollment.id,
      },
    );

    this.eventEmitter.emit(
      APP_EVENTS.COURSE_UNENROLLED,
      {
        userId,
        courseId,
      },
    );

    this.logger.log(
      `User ${userId} unenrolled from course ${courseId}`,
    );
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
    const course =
      await this.courseRepo.findOne({
        where: { id: courseId },
      });

    if (!course) {
      throw new NotFoundException(
        `Course ${courseId} not found`,
      );
    }

    this.assertInstructorOrAdmin(
      course,
      requestingUser,
    );

    const take = Math.min(
      limit,
      EnrollmentsService.MAX_LIMIT,
    );

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
  private validateProgress(
    progress: number,
  ): void {
    if (
      progress < 0 ||
      progress > 100
    ) {
      throw new BadRequestException(
        'Progress must be between 0 and 100',
      );
    }
  }

  /**
   * Check admin/moderator role.
   */
  private isPrivileged(
    user: User,
  ): boolean {
    return [
      UserRole.ADMIN,
      UserRole.MODERATOR,
    ].includes(user.role);
  }

  /**
   * Ensure instructor or admin access.
   */
  private assertInstructorOrAdmin(
    course: Course,
    user: User,
  ): void {
    const allowed =
      course.instructorId ===
        user.id ||
      this.isPrivileged(user);

    if (!allowed) {
      throw new ForbiddenException(
        'Only the course instructor or admins can view course enrollments',
      );
    }
  }
}