import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course, CourseStatus } from './entities/course.entity';
import {
  CourseReview,
  ReviewDecision,
} from './entities/course-review.entity';
import {
  CourseVersion,
  CourseVersionEventType,
} from './entities/course-version.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { SubmitForReviewDto } from './dto/submit-for-review.dto';
import { ReviewCourseDto } from './dto/review-course.dto';

/**
 * Maps a ReviewDecision to the resulting CourseStatus after the decision.
 */
const DECISION_TO_STATUS: Record<ReviewDecision, CourseStatus> = {
  [ReviewDecision.APPROVED]: CourseStatus.PUBLISHED,
  [ReviewDecision.REJECTED]: CourseStatus.REJECTED,
  [ReviewDecision.CHANGES_REQUESTED]: CourseStatus.CHANGES_REQUESTED,
};

/**
 * Core service managing the course publishing workflow.
 */
@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(CourseReview)
    private readonly reviewRepo: Repository<CourseReview>,
    @InjectRepository(CourseVersion)
    private readonly versionRepo: Repository<CourseVersion>,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  /**
   * Creates a new course in DRAFT status for the given instructor.
   */
  async create(dto: CreateCourseDto, instructor: User): Promise<Course> {
    const course = this.courseRepo.create({
      ...dto,
      instructorId: instructor.id,
      status: CourseStatus.DRAFT,
    });
    const savedCourse = await this.courseRepo.save(course);
    await this.createVersionSnapshot(
      savedCourse,
      instructor.id,
      CourseVersionEventType.CREATED,
    );
    return savedCourse;
  }

  /**
   * Returns all courses. Admins/moderators see every status; others see only published.
   */
  async findAll(requestingUser?: User): Promise<Course[]> {
    const isPrivileged =
      requestingUser &&
      [UserRole.ADMIN, UserRole.MODERATOR].includes(requestingUser.role);

    if (isPrivileged) {
      return this.courseRepo.find({ order: { createdAt: 'DESC' } });
    }
    return this.courseRepo.find({
      where: { status: CourseStatus.PUBLISHED },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Returns a single course by ID.
   */
  async findOne(id: string): Promise<Course> {
    const course = await this.courseRepo.findOne({
      where: { id },
      relations: ['instructor', 'reviews', 'reviews.reviewer'],
    });
    if (!course) {
      throw new NotFoundException(`Course ${id} not found`);
    }
    return course;
  }

  /**
   * Updates mutable fields of a course. Only the owner, admin, or moderator may update.
   */
  async update(id: string, dto: UpdateCourseDto, requestingUser: User): Promise<Course> {
    const course = await this.findOne(id);
    this.assertOwnerOrPrivileged(course, requestingUser);
    Object.assign(course, dto);
    const updatedCourse = await this.courseRepo.save(course);
    await this.createVersionSnapshot(
      updatedCourse,
      requestingUser.id,
      CourseVersionEventType.UPDATED,
    );
    return updatedCourse;
  }

  /**
   * Soft-deletes a course. Only the owner, admin, or moderator may delete.
   */
  async remove(id: string, requestingUser: User): Promise<void> {
    const course = await this.findOne(id);
    this.assertOwnerOrPrivileged(course, requestingUser);
    await this.courseRepo.softDelete(id);
  }

  // ─── WORKFLOW ─────────────────────────────────────────────────────────────────

  /**
   * Instructor submits a DRAFT (or CHANGES_REQUESTED) course for moderation.
   */
  async submitForReview(id: string, dto: SubmitForReviewDto, instructor: User): Promise<Course> {
    const course = await this.findOne(id);
    this.assertCourseOwner(course, instructor);

    if (
      course.status !== CourseStatus.DRAFT &&
      course.status !== CourseStatus.CHANGES_REQUESTED
    ) {
      throw new BadRequestException(
        `Cannot submit a course with status "${course.status}" for review. ` +
          `Only DRAFT or CHANGES_REQUESTED courses may be submitted.`,
      );
    }

    course.status = CourseStatus.PENDING_REVIEW;
    course.submissionNote = dto.submissionNote ?? null;
    return this.courseRepo.save(course);
  }

  /**
   * Admin/moderator reviews a PENDING_REVIEW course and records the decision.
   */
  async reviewCourse(id: string, dto: ReviewCourseDto, reviewer: User): Promise<CourseReview> {
    this.assertPrivileged(reviewer);

    const course = await this.findOne(id);
    if (course.status !== CourseStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `Course "${id}" is not pending review (current status: "${course.status}").`,
      );
    }

    const previousStatus = course.status;
    course.status = DECISION_TO_STATUS[dto.decision];
    await this.courseRepo.save(course);

    const review = this.reviewRepo.create({
      courseId: id,
      reviewerId: reviewer.id,
      decision: dto.decision,
      feedback: dto.feedback,
      previousStatus,
    });
    return this.reviewRepo.save(review);
  }

  /**
   * Returns the full review history for a course (newest first).
   */
  async getReviewHistory(id: string): Promise<CourseReview[]> {
    await this.findOne(id); // ensure course exists
    return this.reviewRepo.find({
      where: { courseId: id },
      relations: ['reviewer'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Returns the full version history for a course.
   */
  async getVersionHistory(id: string): Promise<CourseVersion[]> {
    await this.findOne(id);
    return this.versionRepo.find({
      where: { courseId: id },
      relations: ['changedBy'],
      order: { versionNumber: 'DESC' },
    });
  }

  async getVersionDiff(id: string, versionNumber: number) {
    const currentCourse = await this.findOne(id);
    const version = await this.findVersion(id, versionNumber);
    return this.computeCourseChanges(version, currentCourse);
  }

  async rollbackToVersion(
    id: string,
    versionNumber: number,
    requestingUser?: User,
  ): Promise<Course> {
    const course = await this.findOne(id);
    if (requestingUser) {
      this.assertOwnerOrPrivileged(course, requestingUser);
    }
    const version = await this.findVersion(id, versionNumber);

    Object.assign(course, {
      title: version.title,
      description: version.description,
      price: Number(version.price),
      thumbnailUrl: version.thumbnailUrl,
      status: version.status,
      submissionNote: version.submissionNote,
    });

    const rolledBackCourse = await this.courseRepo.save(course);
    await this.createVersionSnapshot(
      rolledBackCourse,
      requestingUser?.id,
      CourseVersionEventType.ROLLEDBACK,
    );
    return rolledBackCourse;
  }

  private async findVersion(
    courseId: string,
    versionNumber: number,
  ): Promise<CourseVersion> {
    const version = await this.versionRepo.findOne({
      where: { courseId, versionNumber },
    });
    if (!version) {
      throw new NotFoundException(
        `Version ${versionNumber} not found for course ${courseId}`,
      );
    }
    return version;
  }

  private async createVersionSnapshot(
    course: Course,
    changedByUserId?: string,
    eventType: CourseVersionEventType = CourseVersionEventType.UPDATED,
  ): Promise<CourseVersion> {
    const previousVersion = await this.versionRepo.findOne({
      where: { courseId: course.id },
      order: { versionNumber: 'DESC' },
    });

    const versionNumber = previousVersion ? previousVersion.versionNumber + 1 : 1;
    const changes = this.computeCourseChanges(previousVersion, course);

    const courseVersion = this.versionRepo.create({
      courseId: course.id,
      versionNumber,
      eventType,
      changedByUserId,
      title: course.title,
      description: course.description,
      price: course.price,
      thumbnailUrl: course.thumbnailUrl,
      status: course.status,
      submissionNote: course.submissionNote,
      changes: Object.keys(changes).length ? changes : null,
    });

    return this.versionRepo.save(courseVersion);
  }

  private computeCourseChanges(
    previous: Partial<CourseVersion> | null,
    current: Partial<Course>,
  ): Record<string, { previous: unknown; next: unknown }> {
    const trackedFields: Array<keyof Course> = [
      'title',
      'description',
      'price',
      'thumbnailUrl',
      'status',
      'submissionNote',
    ];
    const changes: Record<string, { previous: unknown; next: unknown }> = {};

    trackedFields.forEach((field) => {
      const previousValue = previous ? previous[field] : undefined;
      const currentValue = current[field];
      if (previousValue !== currentValue) {
        changes[field as string] = {
          previous: previousValue ?? null,
          next: currentValue ?? null,
        };
      }
    });

    return changes;
  }

  /**
   * Returns all courses currently awaiting moderation.
   */
  async getPendingQueue(requestingUser: User): Promise<Course[]> {
    this.assertPrivileged(requestingUser);
    return this.courseRepo.find({
      where: { status: CourseStatus.PENDING_REVIEW },
      relations: ['instructor'],
      order: { createdAt: 'ASC' },
    });
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  private assertCourseOwner(course: Course, user: User): void {
    if (course.instructorId !== user.id) {
      throw new ForbiddenException('Only the course owner may perform this action.');
    }
  }

  private assertPrivileged(user: User): void {
    if (![UserRole.ADMIN, UserRole.MODERATOR].includes(user.role)) {
      throw new ForbiddenException('Only admins or moderators may perform this action.');
    }
  }

  private assertOwnerOrPrivileged(course: Course, user: User): void {
    const isOwner = course.instructorId === user.id;
    const isPrivileged = [UserRole.ADMIN, UserRole.MODERATOR].includes(user.role);
    if (!isOwner && !isPrivileged) {
      throw new ForbiddenException('Insufficient permissions.');
    }
  }
}
