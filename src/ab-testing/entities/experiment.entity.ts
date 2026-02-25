import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ExperimentVariant } from './experiment-variant.entity';
import { ExperimentMetric } from './experiment-metric.entity';

export enum ExperimentStatus {
  DRAFT = 'draft',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export enum ExperimentType {
  A_B_TEST = 'a_b_test',
  MULTIVARIATE = 'multivariate',
  MULTI_ARMED_BANDIT = 'multi_armed_bandit'
}

@Entity({ name: 'experiments' })
export class Experiment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: ExperimentType,
    default: ExperimentType.A_B_TEST
  })
  type: ExperimentType;

  @Column({
    type: 'enum',
    enum: ExperimentStatus,
    default: ExperimentStatus.DRAFT
  })
  status: ExperimentStatus;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 1.0 })
  trafficAllocation: number;

  @Column({ type: 'boolean', default: false })
  autoAllocateTraffic: boolean;

  @Column({ type: 'integer', default: 95 })
  confidenceLevel: number;

  @Column({ type: 'integer', default: 80 })
  minimumSampleSize: number;

  @Column({ type: 'text', nullable: true })
  hypothesis: string;

  @Column({ type: 'json', nullable: true })
  targetingCriteria: any;

  @Column({ type: 'json', nullable: true })
  exclusionCriteria: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ExperimentVariant, variant => variant.experiment)
  variants: ExperimentVariant[];

  @OneToMany(() => ExperimentMetric, metric => metric.experiment)
  metrics: ExperimentMetric[];
}