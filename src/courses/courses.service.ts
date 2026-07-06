import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CACHE_EVENTS } from '../caching/caching.constants';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseReview, ReviewDecision } from './entities/course-review.entity';
import { CourseVersion, CourseVersionEventType } from './entities/course-version.entity';
import {
  BulkCourseSnapshot,
  BulkOperation,
  BulkOperationStatus,
  BulkOperationType,
} from './entities/bulk-operation.entity';
import { User } from '../users/entities/user.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { SubmitForReviewDto } from './dto/submit-for-review.dto';
import { ReviewCourseDto } from './dto/review-course.dto';
import {
  ResourceNotFoundException,
  ForbiddenOperationException,
  BusinessValidationException,
} from '../common/exceptions/app.exceptions';
import {
  BulkCategoryUpdateDto,
  BulkPriceUpdateDto,
  BulkPublishDto,
} from './dto/bulk-operations.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { OffsetPaginatedResponse } from '../common/interfaces/pagination.interface';
import { buildOffsetResponse } from '../common/utils/pagination.utils';

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
    @InjectRepository(BulkOperation)
    private readonly bulkOpRepo: Repository<BulkOperation>,
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
        throw new ResourceNotFoundException('Prerequisite course', dto.prerequisiteCourseId);
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
    const version = this.versionRepo.create({
      courseId: saved.id,
      versionNumber: 1,
      eventType: CourseVersionEventType.CREATED,
      title: saved.title,
      description: saved.description,
      price: saved.price,
      thumbnailUrl: saved.thumbnailUrl,
      status: saved.status,
    });
    await this.versionRepo.save(version);
    this.eventEmitter.emit(CACHE_EVENTS.COURSE_CREATED, { id: saved.id });
    return saved;
  }

  /**
   * Returns all courses with pagination. Admins/moderators see every status; others see only published.
   */
  async findAll(
    requestingUser?: User,
    query?: PaginationQueryDto,
  ): Promise<OffsetPaginatedResponse<Course>> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const isPrivileged =
      requestingUser &&
      requestingUser.roles?.some((role) =>
        ['admin', 'moderator'].includes(typeof role === 'string' ? role : role.name),
      );

    const where = isPrivileged ? {} : { status: CourseStatus.PUBLISHED };
    const [data, total] = await this.courseRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return buildOffsetResponse(data, total, page, limit);
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
      throw new ResourceNotFoundException('Course', id);
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
          throw new ResourceNotFoundException('Prerequisite course', dto.prerequisiteCourseId);
        }
        course.prerequisite = prerequisite;
      }
    }

    Object.assign(course, dto, { prerequisite: course.prerequisite });
    const saved = await this.courseRepo.save(course);
    const previousVersion = await this.versionRepo.findOne({
      where: { courseId: saved.id },
      order: { versionNumber: 'DESC' },
    });
    const nextVersionNumber = previousVersion ? previousVersion.versionNumber + 1 : 1;
    const version = this.versionRepo.create({
      courseId: saved.id,
      versionNumber: nextVersionNumber,
      eventType: CourseVersionEventType.UPDATED,
      title: saved.title,
      description: saved.description,
      price: saved.price,
      thumbnailUrl: saved.thumbnailUrl,
      status: saved.status,
    });
    await this.versionRepo.save(version);
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

    if (course.status !== CourseStatus.DRAFT && course.status !== CourseStatus.CHANGES_REQUESTED) {
      throw new BusinessValidationException(
        `Cannot submit a course with status "${course.status}" for review. ` +
          'Only DRAFT or CHANGES_REQUESTED courses may be submitted.',
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
      throw new BusinessValidationException(
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

  private async findVersion(courseId: string, versionNumber: number): Promise<CourseVersion> {
    const version = await this.versionRepo.findOne({
      where: { courseId, versionNumber },
    });
    if (!version) {
      throw new ResourceNotFoundException('Course Version', `${versionNumber}`);
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
      throw new ForbiddenOperationException('Only the course owner may perform this action.');
    }
  }

  private assertPrivileged(user: User): void {
    const isPrivileged = user.roles?.some((role) =>
      ['admin', 'moderator'].includes(typeof role === 'string' ? role : role.name),
    );
    if (!isPrivileged) {
      throw new ForbiddenOperationException('Only admins or moderators may perform this action.');
    }
  }

  private assertOwnerOrPrivileged(course: Course, user: User): void {
    const isOwner = course.instructorId === user.id;
    const isPrivileged = user.roles?.some((role) =>
      ['admin', 'moderator'].includes(typeof role === 'string' ? role : role.name),
    );
    if (!isOwner && !isPrivileged) {
      throw new ForbiddenOperationException('Insufficient permissions.');
    }
  }

  // ─── BULK OPERATIONS ─────────────────────────────────────────────────────────

  /**
   * Bulk publish or unpublish a list of courses owned by the caller.
   *
   * Publish moves a course to PUBLISHED (only legal from DRAFT or
   * CHANGES_REQUESTED-via-PENDING_REVIEW workflows is enforced via the
   * normal review flow, but instructors with `admin`/`moderator` roles
   * may force-publish here). Unpublish moves a course to ARCHIVED.
   *
   * Each course is processed independently: failures on one course do
   * not abort the whole batch. A `BulkOperation` record with per-course
   * snapshots is persisted so the action can be undone later.
   */
  async bulkPublish(dto: BulkPublishDto, user: User): Promise<BulkOperation> {
    const targetStatus = dto.publish ? CourseStatus.PUBLISHED : CourseStatus.ARCHIVED;
    const opType = dto.publish ? BulkOperationType.PUBLISH : BulkOperationType.UNPUBLISH;

    return this.runBulkOperation({
      type: opType,
      payload: { publish: dto.publish, targetStatus },
      courseIds: dto.courseIds,
      user,
      apply: (course) => {
        const previous: BulkCourseSnapshot['previous'] = { status: course.status };
        course.status = targetStatus;
        return previous;
      },
    });
  }

  /**
   * Bulk update the `price` field for a list of courses owned by the caller.
   */
  async bulkUpdatePrice(dto: BulkPriceUpdateDto, user: User): Promise<BulkOperation> {
    return this.runBulkOperation({
      type: BulkOperationType.PRICE_UPDATE,
      payload: { price: dto.price },
      courseIds: dto.courseIds,
      user,
      apply: (course) => {
        const previous: BulkCourseSnapshot['previous'] = { price: Number(course.price) };
        course.price = dto.price;
        return previous;
      },
    });
  }

  /**
   * Bulk update the `category` field for a list of courses owned by the caller.
   * Pass `category` as null/undefined in the DTO to clear it.
   */
  async bulkUpdateCategory(dto: BulkCategoryUpdateDto, user: User): Promise<BulkOperation> {
    const nextCategory = dto.category ?? null;
    return this.runBulkOperation({
      type: BulkOperationType.CATEGORY_UPDATE,
      payload: { category: nextCategory },
      courseIds: dto.courseIds,
      user,
      apply: (course) => {
        const previous: BulkCourseSnapshot['previous'] = {
          category: course.category ?? null,
        };
        course.category = nextCategory ?? undefined;
        return previous;
      },
    });
  }

  /**
   * Returns recent bulk operations triggered by the given user (newest first).
   */
  async listBulkOperations(user: User, limit = 50): Promise<BulkOperation[]> {
    return this.bulkOpRepo.find({
      where: { initiatedById: user.id },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /**
   * Reverts a previously executed bulk operation by restoring each
   * affected course's snapshotted field values. Only the user that
   * initiated the operation, or an admin/moderator, may undo it. An
   * already-undone operation cannot be undone again.
   */
  async undoBulkOperation(operationId: string, user: User): Promise<BulkOperation> {
    const op = await this.bulkOpRepo.findOne({ where: { id: operationId } });
    if (!op) {
      throw new ResourceNotFoundException('Bulk operation', operationId);
    }

    const isInitiator = op.initiatedById === user.id;
    const isPrivileged = user.roles.some((role) => ['admin', 'moderator'].includes(role.name));
    if (!isInitiator && !isPrivileged) {
      throw new ForbiddenOperationException(
        'Only the initiator or an admin/moderator may undo this operation.',
      );
    }

    if (op.status === BulkOperationStatus.UNDONE) {
      throw new BusinessValidationException('This bulk operation has already been undone.');
    }

    const appliedSnapshots = (op.snapshots ?? []).filter((s) => s.applied);
    if (appliedSnapshots.length === 0) {
      op.status = BulkOperationStatus.UNDONE;
      op.undoneAt = new Date();
      return this.bulkOpRepo.save(op);
    }

    const courseIds = appliedSnapshots.map((s) => s.courseId);
    const courses = await this.courseRepo.find({ where: { id: In(courseIds) } });
    const courseById = new Map(courses.map((c) => [c.id, c]));

    const restored: Course[] = [];
    for (const snap of appliedSnapshots) {
      const course = courseById.get(snap.courseId);
      if (!course) continue;

      if (snap.previous.status !== undefined) {
        course.status = snap.previous.status as CourseStatus;
      }
      if (snap.previous.price !== undefined) {
        course.price = snap.previous.price;
      }
      if (Object.prototype.hasOwnProperty.call(snap.previous, 'category')) {
        course.category = snap.previous.category ?? undefined;
      }
      restored.push(course);
    }

    if (restored.length > 0) {
      await this.courseRepo.save(restored);
      restored.forEach((c) => this.eventEmitter.emit(CACHE_EVENTS.COURSE_UPDATED, { id: c.id }));
    }

    op.status = BulkOperationStatus.UNDONE;
    op.undoneAt = new Date();
    return this.bulkOpRepo.save(op);
  }

  /**
   * Shared engine for all bulk operations. Loads the requested courses,
   * authorises ownership, applies the per-course mutation, persists
   * results, and records a `BulkOperation` row with snapshots for undo.
   */
  private async runBulkOperation(args: {
    type: BulkOperationType;
    payload: Record<string, unknown>;
    courseIds: string[];
    user: User;
    apply: (course: Course) => BulkCourseSnapshot['previous'];
  }): Promise<BulkOperation> {
    const { type, payload, courseIds, user, apply } = args;
    const isPrivileged = user.roles.some((role) => ['admin', 'moderator'].includes(role.name));

    const courses = await this.courseRepo.find({ where: { id: In(courseIds) } });
    const found = new Map(courses.map((c) => [c.id, c]));

    const snapshots: BulkCourseSnapshot[] = [];
    const toSave: Course[] = [];

    for (const id of courseIds) {
      const course = found.get(id);
      if (!course) {
        snapshots.push({ courseId: id, previous: {}, applied: false, error: 'NOT_FOUND' });
        continue;
      }
      if (!isPrivileged && course.instructorId !== user.id) {
        snapshots.push({ courseId: id, previous: {}, applied: false, error: 'FORBIDDEN' });
        continue;
      }

      try {
        const previous = apply(course);
        snapshots.push({ courseId: id, previous, applied: true });
        toSave.push(course);
      } catch (err) {
        snapshots.push({
          courseId: id,
          previous: {},
          applied: false,
          error: err instanceof Error ? err.message : 'APPLY_FAILED',
        });
      }
    }

    if (toSave.length > 0) {
      await this.courseRepo.save(toSave);
      toSave.forEach((c) => this.eventEmitter.emit(CACHE_EVENTS.COURSE_UPDATED, { id: c.id }));
    }

    const successCount = snapshots.filter((s) => s.applied).length;
    const failureCount = snapshots.length - successCount;
    let status: BulkOperationStatus;
    if (successCount === 0) {
      status = BulkOperationStatus.FAILED;
    } else if (failureCount === 0) {
      status = BulkOperationStatus.COMPLETED;
    } else {
      status = BulkOperationStatus.PARTIAL;
    }

    const op = this.bulkOpRepo.create({
      type,
      status,
      payload,
      snapshots,
      totalCount: courseIds.length,
      successCount,
      failureCount,
      initiatedById: user.id,
    });
    return this.bulkOpRepo.save(op);
  }
}
