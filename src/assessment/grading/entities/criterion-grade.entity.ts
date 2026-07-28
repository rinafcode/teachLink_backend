import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { SubmissionGrade } from './submission-grade.entity';

/**
 * The score awarded for one rubric criterion as part of a SubmissionGrade.
 * The grader either selects a level (`levelId`) or supplies an explicit
 * `points` override; the higher of the two is never accepted — the grading
 * service caps `points` at the criterion's `maxPoints`.
 *
 * The unique (grade_id, criterion_id) constraint guarantees each
 * criterion is scored at most once per grade.
 */
@Entity('criterion_grades')
@Unique('UQ_criterion_grade_per_grade', ['gradeId', 'criterionId'])
export class CriterionGrade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SubmissionGrade, (sg) => sg.criterionGrades, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'grade_id' })
  grade: SubmissionGrade;

  @Column({ name: 'grade_id', type: 'uuid' })
  @Index()
  gradeId: string;

  @Column({ name: 'criterion_id', type: 'uuid' })
  @Index()
  criterionId: string;

  /** Selected rubric level (optional when `points` is provided directly). */
  @Column({ name: 'level_id', type: 'uuid', nullable: true })
  levelId?: string;

  /** Final awarded points for this criterion. */
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  points: number;

  /** Optional grader comment for this criterion. */
  @Column({ type: 'text', nullable: true })
  comment?: string;
}
