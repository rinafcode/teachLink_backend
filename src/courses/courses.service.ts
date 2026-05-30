import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_EVENTS } from '../caching/caching.constants';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseReview, ReviewDecision } from './entities/course-review.entity';
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
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  /**
   * Creates a new course in DRAFT status for the given instructor.
   */
  async create(dto: CreateCourseDto, instructor: User): Promise<Course> {
    let prerequisite = null;
    if (dto.prerequisiteCourseId) {
      prerequisite = await this.courseRepo.findOne({
        where: { id: dto.prerequisiteCourseId },
      });
      if (!prerequisite) {
        throw new NotFoundException(`Prerequisite course ${dto.prerequisiteCourseId} not found`);
      }
    }

    const course = this.courseRepo.create({
      title: dto.title,
      description: dto.description,
      price: dto.price,
      thumbnailUrl: dto.thumbnailUrl,
      instructorId: instructor.id,
      status: CourseStatus.DRAFT,
      prerequisite,
    });
    const saved = await this.courseRepo.save(course);
    this.eventEmitter.emit(CACHE_EVENTS.COURSE_CREATED, { id: saved.id });
    return saved;
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
      relations: ['instructor', 'reviews', 'reviews.reviewer', 'prerequisite'],
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

    if (dto.prerequisiteCourseId !== undefined) {
      if (dto.prerequisiteCourseId === null) {
        course.prerequisite = null;
      } else {
        const prerequisite = await this.courseRepo.findOne({
          where: { id: dto.prerequisiteCourseId },
        });
        if (!prerequisite) {
          throw new NotFoundException(`Prerequisite course ${dto.prerequisiteCourseId} not found`);
        }
        course.prerequisite = prerequisite;
      }
    }

    Object.assign(course, dto, { prerequisite: course.prerequisite });
    const saved = await this.courseRepo.save(course);
    this.eventEmitter.emit(CACHE_EVENTS.COURSE_UPDATED, { id: saved.id });
    return saved;
  }

  /**
   * Soft-deletes a course. Only the owner, admin, or moderator may delete.
   */
  async remove(id: string, requestingUser: User): Promise<void> {
    const course = await this.findOne(id);
    this.assertOwnerOrPrivileged(course, requestingUser);
    await this.courseRepo.softDelete(id);
    this.eventEmitter.emit(CACHE_EVENTS.COURSE_DELETED, { id });
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
    const saved = await this.courseRepo.save(course);
    this.eventEmitter.emit(CACHE_EVENTS.COURSE_UPDATED, { id: saved.id });
    return saved;
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
    this.eventEmitter.emit(CACHE_EVENTS.COURSE_UPDATED, { id: course.id });

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
