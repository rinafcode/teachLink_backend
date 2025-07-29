import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum DeploymentStatus {
  PENDING = 'pending',
  PROGRESSING = 'progressing',
  AVAILABLE = 'available',
  FAILED = 'failed',
  PAUSED = 'paused',
}

export enum DeploymentStrategy {
  ROLLING_UPDATE = 'RollingUpdate',
  RECREATE = 'Recreate',
  BLUE_GREEN = 'BlueGreen',
  CANARY = 'Canary',
}

@Entity('deployments')
@Index(['status', 'strategy'])
@Index(['namespace', 'name'])
export class Deployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, default: 'default' })
  namespace: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: DeploymentStatus,
    default: DeploymentStatus.PENDING,
  })
  status: DeploymentStatus;

  @Column({
    type: 'enum',
    enum: DeploymentStrategy,
    default: DeploymentStrategy.ROLLING_UPDATE,
  })
  strategy: DeploymentStrategy;

  @Column({ type: 'varchar', length: 500 })
  image: string;

  @Column({ type: 'varchar', length: 50 })
  version: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  previousVersion: string;

  @Column({ type: 'int', default: 1 })
  replicas: number;

  @Column({ type: 'int', default: 0 })
  availableReplicas: number;

  @Column({ type: 'int', default: 0 })
  readyReplicas: number;

  @Column({ type: 'int', default: 0 })
  updatedReplicas: number;

  @Column({ type: 'jsonb', nullable: true })
  labels: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  selector: {
    matchLabels?: Record<string, string>;
    matchExpressions?: Array<{
      key: string;
      operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
      values?: string[];
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  template: {
    metadata?: {
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
    };
    spec?: {
      containers: Array<{
        name: string;
        image: string;
        ports?: Array<{
          containerPort: number;
          protocol?: string;
        }>;
        env?: Array<{
          name: string;
          value?: string;
          valueFrom?: Record<string, any>;
        }>;
        resources?: {
          requests?: Record<string, string>;
          limits?: Record<string, string>;
        };
        livenessProbe?: Record<string, any>;
        readinessProbe?: Record<string, any>;
      }>;
      volumes?: Array<{
        name: string;
        configMap?: Record<string, any>;
        secret?: Record<string, any>;
        persistentVolumeClaim?: Record<string, any>;
      }>;
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  rollingUpdateConfig: {
    maxUnavailable?: string | number;
    maxSurge?: string | number;
  };

  @Column({ type: 'jsonb', nullable: true })
  blueGreenConfig: {
    activeService?: string;
    previewService?: string;
    autoRollback?: boolean;
    scaleDownDelaySeconds?: number;
    prePromotionAnalysis?: Record<string, any>;
    postPromotionAnalysis?: Record<string, any>;
  };

  @Column({ type: 'jsonb', nullable: true })
  canaryConfig: {
    steps?: Array<{
      setWeight?: number;
      pause?: {
        duration?: string;
        untilApproved?: boolean;
      };
      setCanaryScale?: {
        weight?: number;
        replicas?: number;
      };
      analysis?: Record<string, any>;
    }>;
    trafficRouting?: {
      nginx?: Record<string, any>;
      istio?: Record<string, any>;
      alb?: Record<string, any>;
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  conditions: Array<{
    type: string;
    status: 'True' | 'False' | 'Unknown';
    lastUpdateTime: Date;
    lastTransitionTime: Date;
    reason?: string;
    message?: string;
  }>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  clusterId: string;

  @Column({ type: 'timestamptz', nullable: true })
  deploymentStartTime: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deploymentEndTime: Date;

  @Column({ type: 'int', nullable: true })
  progressDeadlineSeconds: number;

  @Column({ type: 'int', default: 10 })
  revisionHistoryLimit: number;

  @Column({ type: 'boolean', default: false })
  paused: boolean;

  @Column({ type: 'jsonb', nullable: true })
  healthCheck: {
    status: 'healthy' | 'unhealthy' | 'unknown';
    lastChecked?: Date;
    checks?: Array<{
      name: string;
      status: 'passing' | 'warning' | 'critical';
      output?: string;
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  rollbackConfig: {
    enabled?: boolean;
    autoTrigger?: boolean;
    conditions?: Array<{
      metric: string;
      threshold: number;
      comparison: 'gt' | 'lt' | 'eq';
    }>;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
