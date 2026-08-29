import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  VersionColumn,
  Index,
} from 'typeorm';
import { Experiment } from './experiment.entity';
export enum MetricType {
  CONVERSION = 'conversion',
  REVENUE = 'revenue',
  ENGAGEMENT = 'engagement',
  RETENTION = 'retention',
  CUSTOM = 'custom',
}

/**
 * Represents the experiment Metric entity.
 */
@Entity({ name: 'experiment_metrics' })
@Index('IDX_experiment_metrics_experiment_id', ['experiment'])
@Index('IDX_experiment_metrics_type', ['type'])
@Index('IDX_experiment_metrics_created_at', ['createdAt'])
@Index('IDX_experiment_metrics_experiment_is_primary', ['experiment', 'isPrimary'])
export class ExperimentMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: MetricType,
    default: MetricType.CONVERSION,
  })
  type: MetricType;

  @Column({ type: 'json', nullable: true })
  configuration: any;

  @Column({ type: 'boolean', default: true })
  isPrimary: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Experiment, (experiment) => experiment.metrics)
  experiment: Experiment;
}

