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
import { ModelVersion } from './model-version.entity';
import { DeploymentStatus, DeploymentEnvironment } from '../enums';

@Entity('model_deployments')
export class ModelDeployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: DeploymentStatus,
    default: DeploymentStatus.PENDING,
  })
  status: DeploymentStatus;

  @Column({
    type: 'enum',
    enum: DeploymentEnvironment,
    default: DeploymentEnvironment.DEVELOPMENT,
  })
  environment: DeploymentEnvironment;

  @Column({ type: 'varchar', length: 255, nullable: true })
  endpoint: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  serviceUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  deploymentConfig: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  scalingConfig: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  resourceConfig: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  healthCheckConfig: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  monitoringConfig: Record<string, any>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  previousDeploymentId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rollbackToDeploymentId: string;

  @Column({ type: 'jsonb', nullable: true })
  deploymentMetrics: Record<string, any>;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  currentAccuracy: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  currentLatency: number;

  @Column({ type: 'integer', nullable: true })
  requestCount: number;

  @Column({ type: 'integer', nullable: true })
  errorCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  errorRate: number;

  @Column({ type: 'jsonb', nullable: true })
  performanceMetrics: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  deployedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  rolledBackAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  undeployedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deployedBy: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rolledBackBy: string;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  deploymentLogs: string[];

  @Column({ type: 'boolean', default: false })
  isRollback: boolean;

  @Column({ type: 'uuid', nullable: true })
  rollbackFromDeploymentId: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => MLModel, (model) => model.deployments)
  @JoinColumn({ name: 'modelId' })
  model: MLModel;

  @Column({ type: 'uuid' })
  modelId: string;

  @ManyToOne(() => ModelVersion, (version) => version.deployments)
  @JoinColumn({ name: 'versionId' })
  version: ModelVersion;

  @Column({ type: 'uuid' })
  versionId: string;
}
