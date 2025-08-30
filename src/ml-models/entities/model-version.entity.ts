import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { MLModel } from './ml-model.entity';
import { ModelDeployment } from './model-deployment.entity';
import { VersionStatus } from '../enums';

@Entity('model_versions')
export class ModelVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  version: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: VersionStatus,
    default: VersionStatus.DRAFT
  })
  status: VersionStatus;

  @Column({ type: 'jsonb', nullable: true })
  hyperparameters: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  trainingConfig: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  dataConfig: Record<string, any>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  artifactPath: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  modelHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  parentVersionId: string;

  @Column({ type: 'jsonb', nullable: true })
  trainingMetrics: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  validationMetrics: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  testMetrics: Record<string, any>;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  accuracy: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  precision: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  recall: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  f1Score: number;

  @Column({ type: 'jsonb', nullable: true })
  featureImportance: Record<string, number>;

  @Column({ type: 'jsonb', nullable: true })
  confusionMatrix: number[][];

  @Column({ type: 'jsonb', nullable: true })
  rocCurve: Record<string, number[]>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  trainedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  validatedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => MLModel, model => model.versions)
  @JoinColumn({ name: 'modelId' })
  model: MLModel;

  @Column({ type: 'uuid' })
  modelId: string;

  @OneToMany(() => ModelDeployment, deployment => deployment.version)
  deployments: ModelDeployment[];
} 