import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { ContainerCluster } from './container-cluster.entity';
import { ContainerMetrics } from './container-metrics.entity';

export enum ContainerStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  UNKNOWN = 'unknown',
  TERMINATING = 'terminating',
}

export enum ContainerRestartPolicy {
  ALWAYS = 'Always',
  ON_FAILURE = 'OnFailure',
  NEVER = 'Never',
}

@Entity('containers')
@Index(['status', 'clusterId'])
@Index(['namespace', 'name'])
export class Container {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, default: 'default' })
  namespace: string;

  @Column({ type: 'varchar', length: 500 })
  image: string;

  @Column({ type: 'varchar', length: 50 })
  tag: string;

  @Column({
    type: 'enum',
    enum: ContainerStatus,
    default: ContainerStatus.PENDING,
  })
  status: ContainerStatus;

  @Column({
    type: 'enum',
    enum: ContainerRestartPolicy,
    default: ContainerRestartPolicy.ALWAYS,
  })
  restartPolicy: ContainerRestartPolicy;

  @Column({ type: 'jsonb', nullable: true })
  environment: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  ports: Array<{
    containerPort: number;
    hostPort?: number;
    protocol?: string;
    name?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  resources: {
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  volumeMounts: Array<{
    name: string;
    mountPath: string;
    readOnly?: boolean;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  livenessProbe: {
    httpGet?: {
      path: string;
      port: number;
    };
    tcpSocket?: {
      port: number;
    };
    exec?: {
      command: string[];
    };
    initialDelaySeconds?: number;
    periodSeconds?: number;
    timeoutSeconds?: number;
    successThreshold?: number;
    failureThreshold?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  readinessProbe: {
    httpGet?: {
      path: string;
      port: number;
    };
    tcpSocket?: {
      port: number;
    };
    exec?: {
      command: string[];
    };
    initialDelaySeconds?: number;
    periodSeconds?: number;
    timeoutSeconds?: number;
    successThreshold?: number;
    failureThreshold?: number;
  };

  @Column({ type: 'varchar', length: 255, nullable: true })
  nodeId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  podId: string;

  @Column({ type: 'uuid', nullable: true })
  clusterId: string;

  @Column({ type: 'int', default: 1 })
  replicas: number;

  @Column({ type: 'int', default: 0 })
  availableReplicas: number;

  @Column({ type: 'int', default: 0 })
  readyReplicas: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastRestartTime: Date;

  @Column({ type: 'int', default: 0 })
  restartCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => ContainerCluster, (cluster) => cluster.containers, { nullable: true })
  @JoinColumn({ name: 'clusterId' })
  cluster: ContainerCluster;

  @OneToMany(() => ContainerMetrics, (metric) => metric.container)
  metrics: ContainerMetrics[];
}
