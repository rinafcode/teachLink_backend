import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Rubric } from './rubric.entity';
import { CriterionGrade } from './criterion-grade.entity';

/** Lifecycle of a submission grade. */
export enum SubmissionGradeStatus {
  /** Created but no scores yet. */
  PENDING = 'pending',
  /** Manually graded by an instructor. */
  GRADED = 'graded',
  /** Auto-graded using rubric defaults. */
  AUTO_GRADED = 'auto_graded',
}

/**
 * The result of applying a rubric to a single submission/attempt.
 * Aggregates per-criterion grades plus a rendered feedback string.
 * The unique (attempt_id) constraint prevents duplicate grades for
 * the same attempt; re-grading mutates the existing record.
 */
@Entity('submission_grades')
@Unique('UQ_submission_grade_attempt', ['attemptId'])
export class SubmissionGrade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The graded assessment attempt. */
  @Column({ name: 'attempt_id', type: 'uuid' })
  @Index()
  attemptId: string;

  @ManyToOne(() => Rubric, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rubric_id' })
  rubric: Rubric;

  @Column({ name: 'rubric_id', type: 'uuid' })
  @Index()
  rubricId: string;

  /** Optional grader (admin/instructor). Null when auto-graded. */
  @Column({ name: 'grader_id', type: 'uuid', nullable: true })
  graderId?: string;

  @Column({
    type: 'enum',
    enum: SubmissionGradeStatus,
    default: SubmissionGradeStatus.PENDING,
  })
  status: SubmissionGradeStatus;

  /** Sum of every criterion's awarded points. */
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  totalScore: number;

  /** Sum of every criterion's `maxPoints` (snapshot of the rubric). */
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  maxScore: number;

  /** Convenience: totalScore / maxScore * 100 (0–100). */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  percentage: number;

  /** Rendered feedback (after applying any feedback template). */
  @Column({ type: 'text', nullable: true })
  feedback?: string;

  /** Optional template that produced `feedback`. */
  @Column({ name: 'feedback_template_id', type: 'uuid', nullable: true })
  feedbackTemplateId?: string;

  @OneToMany(() => CriterionGrade, cg => cg.grade, { cascade: true })
  criterionGrades: CriterionGrade[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
