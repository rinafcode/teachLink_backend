import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { ExperimentVariant } from './experiment-variant.entity';

@Entity({ name: 'variant_metrics' })
export class VariantMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 15, scale: 4, default: 0 })
  value: number;

  @Column({ type: 'integer', default: 0 })
  sampleSize: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  conversionRate?: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  standardDeviation?: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  confidenceIntervalLower?: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  confidenceIntervalUpper?: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  pValue?: number;

  @Column({ type: 'boolean', default: false })
  isStatisticallySignificant: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => ExperimentVariant, variant => variant.metrics)
  variant: ExperimentVariant;
}