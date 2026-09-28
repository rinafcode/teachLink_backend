import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Course } from './course.entity';
import { User } from '../../users/entities/user.entity';

/** Possible decisions on a course review. */
export enum ReviewDecision {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CHANGES_REQUESTED = 'changes_requested',
}

/**
 * Records each moderation decision made on a course submission.
 * A course can have multiple review records (revision history).
 */
@Entity('course_reviews')
export class CourseReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The course that was reviewed. */
  @ManyToOne(() => Course, (course) => course.reviews, { onDelete: 'CASCADE' })
  course: Course;

  @Column({ name: 'course_id' })
  @Index()
  courseId: string;

  /** The admin/moderator who made the decision. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  reviewer: User;

  @Column({ name: 'reviewer_id', nullable: true })
  reviewerId: string;

  @Column({
    type: 'enum',
    enum: ReviewDecision,
  })
  decision: ReviewDecision;

  /** Feedback sent back to the instructor. */
  @Column({ type: 'text', nullable: true })
  feedback?: string;

  /** Snapshot of the course status before the decision. */
  @Column({ type: 'varchar', length: '50', nullable: true })
  previousStatus?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
