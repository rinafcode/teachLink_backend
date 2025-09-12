import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Container } from './container.entity';
import { LoadBalancer } from './load-balancer.entity';

export enum ClusterStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  UPDATING = 'updating',
  DELETING = 'deleting',
  FAILED = 'failed',
}

export enum ClusterProvider {
  AWS_EKS = 'aws-eks',
  GOOGLE_GKE = 'google-gke',
  AZURE_AKS = 'azure-aks',
  DIGITAL_OCEAN = 'digital-ocean',
  ON_PREMISE = 'on-premise',
}

@Entity('container_clusters')
@Index(['status', 'provider'])
@Index(['region', 'provider'])
export class ContainerCluster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ClusterStatus,
    default: ClusterStatus.INITIALIZING,
  })
  status: ClusterStatus;

  @Column({
    type: 'enum',
    enum: ClusterProvider,
  })
  provider: ClusterProvider;

  @Column({ type: 'varchar', length: 100 })
  region: string;

  @Column({ type: 'varchar', length: 50 })
  version: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  endpoint: string;

  @Column({ type: 'text', nullable: true })
  kubeconfig: string;

  @Column({ type: 'jsonb', nullable: true })
  nodeGroups: Array<{
    name: string;
    instanceType: string;
    minSize: number;
    maxSize: number;
    desiredSize: number;
    diskSize: number;
    labels?: Record<string, string>;
    taints?: Array<{
      key: string;
      value: string;
      effect: string;
    }>;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  networking: {
    vpc?: string;
    subnets?: string[];
    securityGroups?: string[];
    podCidr?: string;
    serviceCidr?: string;
    dnsService?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  addons: {
    dashboard?: boolean;
    logging?: boolean;
    monitoring?: boolean;
    autoScaler?: boolean;
    nginx?: boolean;
    certManager?: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  authentication: {
    rbac?: boolean;
    serviceAccounts?: Array<{
      name: string;
      namespace: string;
      permissions: string[];
    }>;
  };

  @Column({ type: 'int', default: 0 })
  totalNodes: number;

  @Column({ type: 'int', default: 0 })
  readyNodes: number;

  @Column({ type: 'int', default: 0 })
  totalPods: number;

  @Column({ type: 'int', default: 0 })
  runningPods: number;

  @Column({ type: 'jsonb', nullable: true })
  resourceQuotas: {
    cpu?: string;
    memory?: string;
    storage?: string;
    pods?: number;
    services?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  healthCheck: {
    lastChecked?: Date;
    status?: 'healthy' | 'unhealthy' | 'unknown';
    issues?: string[];
  };

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  monthlyCost: number;

  @Column({ type: 'jsonb', nullable: true })
  tags: Record<string, string>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Container, (container) => container.cluster)
  containers: Container[];

  @OneToMany(() => LoadBalancer, (loadBalancer) => loadBalancer.cluster)
  loadBalancers: LoadBalancer[];
}
