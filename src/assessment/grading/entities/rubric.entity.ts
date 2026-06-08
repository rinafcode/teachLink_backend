import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { RubricCriterion } from './rubric-criterion.entity';

/**
 * A reusable rubric used to grade submissions/assessment attempts.
 * A rubric is a named collection of weighted criteria, each with one
 * or more performance levels. The total possible score is the sum of
 * the criteria's `maxPoints`.
 */
@Entity('rubrics')
export class Rubric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Optional owner (instructor/admin) — used for ownership checks. */
  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  @Index()
  ownerId?: string;

  /**
   * Optional assessment binding. When set, this rubric is the default
   * grading rubric for that assessment. A rubric can also be reused
   * across many assessments by leaving this null.
   */
  @Column({ name: 'assessment_id', type: 'uuid', nullable: true })
  @Index()
  assessmentId?: string;

  /**
   * Sum of every criterion's `maxPoints`. Recomputed by the service
   * any time criteria are added/updated.
   */
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  totalPoints: number;

  /**
   * When true, every criterion has a default level so the rubric can
   * be auto-graded without instructor input.
   */
  @Column({ default: false })
  autoGradeEnabled: boolean;

  @OneToMany(() => RubricCriterion, (criterion) => criterion.rubric, {
    cascade: true,
  })
  criteria: RubricCriterion[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
