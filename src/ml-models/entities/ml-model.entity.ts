import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ModelVersion } from './model-version.entity';
import { ModelDeployment } from './model-deployment.entity';
import { ModelPerformance } from './model-performance.entity';
import { ModelStatus, ModelType, ModelFramework } from '../enums';

@Entity('ml_models')
export class MLModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ModelType,
    default: ModelType.CLASSIFICATION,
  })
  type: ModelType;

  @Column({
    type: 'enum',
    enum: ModelFramework,
    default: ModelFramework.SCIKIT_LEARN,
  })
  framework: ModelFramework;

  @Column({
    type: 'enum',
    enum: ModelStatus,
    default: ModelStatus.DRAFT,
  })
  status: ModelStatus;

  @Column({ type: 'jsonb', nullable: true })
  hyperparameters: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  features: string[];

  @Column({ type: 'jsonb', nullable: true })
  targetVariable: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  artifactPath: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  modelHash: string;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  currentAccuracy: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  currentPrecision: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  currentRecall: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  currentF1Score: number;

  @Column({ type: 'jsonb', nullable: true })
  trainingMetrics: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  validationMetrics: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  lastTrainedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastDeployedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => ModelVersion, (version) => version.model)
  versions: ModelVersion[];

  @OneToMany(() => ModelDeployment, (deployment) => deployment.model)
  deployments: ModelDeployment[];

  @OneToMany(() => ModelPerformance, (performance) => performance.model)
  performances: ModelPerformance[];
}
