import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MLModel } from './ml-model.entity';
import { ABTestStatus, ABTestType } from '../enums';

@Entity('ab_tests')
export class ABTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ABTestStatus,
    default: ABTestStatus.DRAFT
  })
  status: ABTestStatus;

  @Column({
    type: 'enum',
    enum: ABTestType,
    default: ABTestType.TRAFFIC_SPLIT
  })
  type: ABTestType;

  @Column({ type: 'varchar', length: 255 })
  modelAId: string;

  @Column({ type: 'varchar', length: 255 })
  modelBId: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.5 })
  trafficSplit: number;

  @Column({ type: 'jsonb', nullable: true })
  testConfig: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  successMetrics: string[];

  @Column({ type: 'jsonb', nullable: true })
  guardrailMetrics: string[];

  @Column({ type: 'integer', nullable: true })
  minSampleSize: number;

  @Column({ type: 'integer', nullable: true })
  maxDurationDays: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  significanceLevel: number;

  @Column({ type: 'jsonb', nullable: true })
  results: Record<string, any>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  winnerModelId: string;

  @Column({ type: 'boolean', nullable: true })
  isStatisticallySignificant: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  confidenceLevel: number;

  @Column({ type: 'jsonb', nullable: true })
  modelAMetrics: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  modelBMetrics: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  scheduledEndAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stoppedBy: string;

  @Column({ type: 'text', nullable: true })
  stopReason: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => MLModel)
  @JoinColumn({ name: 'modelAId' })
  modelA: MLModel;

  @ManyToOne(() => MLModel)
  @JoinColumn({ name: 'modelBId' })
  modelB: MLModel;

  @ManyToOne(() => MLModel)
  @JoinColumn({ name: 'winnerModelId' })
  winnerModel: MLModel;
} 