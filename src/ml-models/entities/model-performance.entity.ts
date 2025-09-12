import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MLModel } from './ml-model.entity';
import { PerformanceMetricType, DriftSeverity } from '../enums';

@Entity('model_performances')
export class ModelPerformance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  metricName: string;

  @Column({
    type: 'enum',
    enum: PerformanceMetricType,
    default: PerformanceMetricType.ACCURACY,
  })
  metricType: PerformanceMetricType;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  value: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  baselineValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  threshold: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  driftScore: number;

  @Column({
    type: 'enum',
    enum: DriftSeverity,
    default: DriftSeverity.NONE,
  })
  driftSeverity: DriftSeverity;

  @Column({ type: 'boolean', default: false })
  isDriftDetected: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, any>;

  @Column({ type: 'timestamp' })
  recordedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recordedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => MLModel, (model) => model.performances)
  @JoinColumn({ name: 'modelId' })
  model: MLModel;

  @Column({ type: 'uuid' })
  modelId: string;
}
