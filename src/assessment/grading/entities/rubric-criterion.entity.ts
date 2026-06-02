import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Rubric } from './rubric.entity';
import { RubricLevel } from './rubric-level.entity';

/**
 * A single criterion in a rubric (e.g. "Code quality", "Clarity").
 * Each criterion is independently scored against its `levels`. The
 * criterion's `maxPoints` represents the highest possible award
 * (typically equal to the highest-scoring level).
 */
@Entity('rubric_criteria')
export class RubricCriterion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Rubric, rubric => rubric.criteria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rubric_id' })
  rubric: Rubric;

  @Column({ name: 'rubric_id', type: 'uuid' })
  @Index()
  rubricId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Maximum points this criterion can contribute to the final grade. */
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  maxPoints: number;

  /**
   * Display order (lowest first). Lets the UI render criteria in a
   * deterministic order rather than relying on insertion order.
   */
  @Column({ type: 'int', default: 0 })
  orderIndex: number;

  /**
   * Optional default level for auto-grading. When set, the grading
   * service can pre-fill the criterion's selected level so the rubric
   * can be applied without instructor input.
   */
  @Column({ name: 'default_level_id', type: 'uuid', nullable: true })
  defaultLevelId?: string;

  @OneToMany(() => RubricLevel, level => level.criterion, { cascade: true })
  levels: RubricLevel[];
}
