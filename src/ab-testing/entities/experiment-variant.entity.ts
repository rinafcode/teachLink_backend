import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  VersionColumn,
  Index,
} from 'typeorm';
import { Experiment } from './experiment.entity';
import { VariantMetric } from './variant-metric.entity';

/**
 * Represents the experiment Variant entity.
 *
 * ## Indexes (#1223)
 *
 * Every real query path against this entity loads variants through the
 * `experiment` relation (`experimentRepository.findOne({ relations: [...] })`
 * across `ab-testing.service.ts`, `experiments/experiment.service.ts`,
 * `analysis/statistical-analysis.service.ts`,
 * `automation/automated-decision.service.ts`, and
 * `reporting/ab-testing-reports.service.ts`), then filters the loaded array
 * in-memory for the control variant (`v.isControl`) or the winning variant
 * (`v.isWinner`) — every one of those service methods does this. There is
 * no direct `variantRepository.find({ where: ... })` call anywhere in this
 * codebase filtering on anything else.
 *
 * The two composite indexes below match that access shape directly —
 * `(experiment, isControl)` and `(experiment, isWinner)` — rather than a
 * plain single-column index on `experiment` alone: leftmost-prefix lookup
 * means either composite already serves a plain "all variants for this
 * experiment" query just as well as a dedicated `experiment`-only index
 * would, so adding one of those *in addition* would only be a redundant,
 * un-selective duplicate (`isControl`/`isWinner` are booleans — indexing
 * either alone, without the `experiment` prefix, has essentially no
 * selectivity and no query in this codebase would use it that way).
 *
 * See `src/migrations/1802000000000-add-experiment-variant-indexes.ts` for
 * the migration that creates the same two indexes on an existing database
 * (`synchronize` is `false` in `src/config/datasource.ts`, so the
 * `@Index` decorators below are the schema's documentation of intent, not
 * what actually creates the indexes).
 */
@Entity({ name: 'experiment_variants' })
@Index(['experiment', 'isControl'])
@Index(['experiment', 'isWinner'])
export class IExperimentVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'json' })
  configuration: any;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  trafficAllocation: number;

  @Column({ type: 'boolean', default: false })
  isControl: boolean;

  @Column({ type: 'boolean', default: false })
  isWinner: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @ManyToOne(() => Experiment, (experiment) => experiment.variants)
  experiment: Experiment;

  @OneToMany(() => VariantMetric, (metric) => metric.variant)
  metrics: VariantMetric[];
}
