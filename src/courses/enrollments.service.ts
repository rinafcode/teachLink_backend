import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Course, CourseStatus } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CACHE_EVENTS } from '../caching/caching.constants';
import { APP_EVENTS } from '../common/constants/event.constants';
import { APP_CONSTANTS } from '../common/constants/app.constants';

/**
 * Service managing course enrollments with prerequisite enforcement.
 */
@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Enrolls a user in a course, enforcing prerequisite requirements.
   */
  async enroll(userId: string, courseId: string): Promise<Enrollment> {
    const course = await this.courseRepo.findOne({
      where: { id: courseId },
      relations: ['prerequisite'],
    });

    if (!course) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    if (course.status !== CourseStatus.PUBLISHED) {
      throw new BadRequestException(
        `Cannot enroll in a course with status "${course.status}". Only published courses can be enrolled in.`,
      );
    }

    // Check if already enrolled
    const existingEnrollment = await this.enrollmentRepo.findOne({
      where: { userId, courseId },
    });

    if (existingEnrollment) {
      throw new BadRequestException('User is already enrolled in this course');
    }

    // Enforce prerequisite check
    await this.validatePrerequisites(userId, course);

    const enrollment = this.enrollmentRepo.create({
      userId,
      courseId,
      status: APP_CONSTANTS.ENROLLMENT_STATUS.ACTIVE,
      progress: 0,
    });

    const saved = await this.enrollmentRepo.save(enrollment);

    // Emit events
    this.eventEmitter.emit(CACHE_EVENTS.ENROLLMENT_CREATED, { id: saved.id });
    this.eventEmitter.emit(APP_EVENTS.COURSE_ENROLLED, { userId, courseId });

    return saved;
  }

  /**
   * Validates that the user has completed all prerequisite courses.
   */
  private async validatePrerequisites(userId: string, course: Course): Promise<void> {
    if (!course.prerequisite) {
      return; // No prerequisites
    }

    const prerequisiteEnrollment = await this.enrollmentRepo.findOne({
      where: {
        userId,
        courseId: course.prerequisite.id,
        status: APP_CONSTANTS.ENROLLMENT_STATUS.COMPLETED,
      },
    });

    if (!prerequisiteEnrollment) {
      throw new BadRequestException(
        `Cannot enroll in "${course.title}". You must first complete the prerequisite course "${course.prerequisite.title}".`,
      );
    }
  }

  /**
   * Gets all enrollments for a user.
   */
  async getUserEnrollments(userId: string): Promise<Enrollment[]> {
    return this.enrollmentRepo.find({
      where: { userId },
      relations: ['course', 'course.instructor'],
      order: { enrolledAt: 'DESC' },
    });
  }

  /**
   * Gets a specific enrollment by ID.
   */
  async findOne(id: string, userId: string): Promise<Enrollment> {
    const enrollment = await this.enrollmentRepo.findOne({
      where: { id },
      relations: ['course', 'course.instructor', 'course.prerequisite'],
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${id} not found`);
    }

    // Only the enrolled user or admin can view the enrollment
    if (enrollment.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view this enrollment');
    }

    return enrollment;
  }

  /**
   * Updates enrollment progress.
   */
  async updateProgress(
    id: string,
    progress: number,
    userId: string,
  ): Promise<Enrollment> {
    const enrollment = await this.findOne(id, userId);

    if (progress < 0 || progress > 100) {
      throw new BadRequestException('Progress must be between 0 and 100');
    }

    enrollment.progress = progress;

    // Auto-complete status when progress reaches 100
    if (progress === 100) {
      enrollment.status = APP_CONSTANTS.ENROLLMENT_STATUS.COMPLETED;
      this.eventEmitter.emit(APP_EVENTS.COURSE_COMPLETED, {
        userId: enrollment.userId,
        courseId: enrollment.courseId,
      });
    }

    const saved = await this.enrollmentRepo.save(enrollment);
    this.eventEmitter.emit(CACHE_EVENTS.ENROLLMENT_UPDATED, { id: saved.id });

    return saved;
  }

  /**
   * Unenrolls a user from a course.
   */
  async unenroll(userId: string, courseId: string): Promise<void> {
    const enrollment = await this.enrollmentRepo.findOne({
      where: { userId, courseId },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    await this.enrollmentRepo.remove(enrollment);
    this.eventEmitter.emit(CACHE_EVENTS.ENROLLMENT_UPDATED, { id: enrollment.id });
  }

  /**
   * Gets all enrollments for a specific course (for instructors/admins).
   */
  async getCourseEnrollments(courseId: string, requestingUser: User): Promise<Enrollment[]> {
    const course = await this.courseRepo.findOne({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    // Only the course instructor or admins can view all enrollments
    const isInstructor = course.instructorId === requestingUser.id;
    const isAdmin = [UserRole.ADMIN, UserRole.MODERATOR].includes(requestingUser.role);

    if (!isInstructor && !isAdmin) {
      throw new ForbiddenException(
        'Only the course instructor or admins can view course enrollments',
      );
    }

    return this.enrollmentRepo.find({
      where: { courseId },
      relations: ['user'],
      order: { enrolledAt: 'DESC' },
    });
  }
}
