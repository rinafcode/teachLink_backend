import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Experiment } from './experiment.entity';
import { VariantMetric } from './variant-metric.entity';

@Entity({ name: 'experiment_variants' })
export class ExperimentVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @ManyToOne(() => Experiment, experiment => experiment.variants)
  experiment: Experiment;

  @OneToMany(() => VariantMetric, metric => metric.variant)
  metrics: VariantMetric[];
}