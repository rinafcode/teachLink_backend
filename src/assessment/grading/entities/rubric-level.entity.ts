import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RubricCriterion } from './rubric-criterion.entity';

/**
 * A discrete performance level on a rubric criterion (e.g. "Excellent",
 * "Good", "Needs improvement"). When a grader scores a criterion, they
 * pick exactly one level. The level's `points` are awarded for that
 * criterion, capped at the criterion's `maxPoints`.
 */
@Entity('rubric_levels')
export class RubricLevel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => RubricCriterion, criterion => criterion.levels, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'criterion_id' })
  criterion: RubricCriterion;

  @Column({ name: 'criterion_id', type: 'uuid' })
  @Index()
  criterionId: string;

  /** Short label, e.g. "Excellent". */
  @Column()
  label: string;

  /** Long-form description rendered in the rubric scoring UI. */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Points awarded when this level is selected. */
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  points: number;

  /** Display order within the criterion (lowest first). */
  @Column({ type: 'int', default: 0 })
  orderIndex: number;
}
