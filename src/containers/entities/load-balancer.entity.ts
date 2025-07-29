import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ContainerCluster } from './container-cluster.entity';

export enum LoadBalancerType {
  CLUSTER_IP = 'ClusterIP',
  NODE_PORT = 'NodePort',
  LOAD_BALANCER = 'LoadBalancer',
  EXTERNAL_NAME = 'ExternalName',
  INGRESS = 'Ingress',
}

export enum LoadBalancerStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  FAILED = 'failed',
  TERMINATING = 'terminating',
}

export enum LoadBalancingAlgorithm {
  ROUND_ROBIN = 'round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  IP_HASH = 'ip_hash',
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
  LEAST_RESPONSE_TIME = 'least_response_time',
}

@Entity('load_balancers')
@Index(['status', 'type'])
@Index(['namespace', 'name'])
export class LoadBalancer {
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
    enum: LoadBalancerType,
    default: LoadBalancerType.CLUSTER_IP,
  })
  type: LoadBalancerType;

  @Column({
    type: 'enum',
    enum: LoadBalancerStatus,
    default: LoadBalancerStatus.PENDING,
  })
  status: LoadBalancerStatus;

  @Column({
    type: 'enum',
    enum: LoadBalancingAlgorithm,
    default: LoadBalancingAlgorithm.ROUND_ROBIN,
  })
  algorithm: LoadBalancingAlgorithm;

  @Column({ type: 'varchar', length: 255, nullable: true })
  clusterIP: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalIP: string;

  @Column({ type: 'text', array: true, nullable: true })
  externalIPs: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  loadBalancerIP: string;

  @Column({ type: 'text', array: true, nullable: true })
  loadBalancerSourceRanges: string[];

  @Column({ type: 'jsonb', nullable: true })
  ports: Array<{
    name?: string;
    port: number;
    targetPort: number | string;
    protocol?: 'TCP' | 'UDP' | 'SCTP';
    nodePort?: number;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  selector: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  endpoints: Array<{
    ip: string;
    port: number;
    ready: boolean;
    weight?: number;
    zone?: string;
    nodeName?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  ingressRules: Array<{
    host?: string;
    http?: {
      paths: Array<{
        path: string;
        pathType?: 'Exact' | 'Prefix' | 'ImplementationSpecific';
        backend: {
          service: {
            name: string;
            port: {
              number?: number;
              name?: string;
            };
          };
        };
      }>;
    };
    tls?: Array<{
      hosts: string[];
      secretName?: string;
    }>;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  annotations: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  healthCheck: {
    enabled: boolean;
    path?: string;
    port?: number;
    interval?: number;
    timeout?: number;
    unhealthyThreshold?: number;
    healthyThreshold?: number;
    protocol?: 'HTTP' | 'HTTPS' | 'TCP';
  };

  @Column({ type: 'jsonb', nullable: true })
  stickySession: {
    enabled: boolean;
    type?: 'cookie' | 'ip';
    cookieName?: string;
    cookieDuration?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  ssl: {
    enabled: boolean;
    certificateArn?: string;
    redirectHttpToHttps?: boolean;
    policy?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  accessLogs: {
    enabled: boolean;
    s3Bucket?: string;
    s3Prefix?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  connectionDraining: {
    enabled: boolean;
    timeout?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  crossZoneLoadBalancing: {
    enabled: boolean;
  };

  @Column({ type: 'int', default: 0 })
  activeConnections: number;

  @Column({ type: 'int', default: 0 })
  totalRequests: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  averageResponseTime: number;

  @Column({ type: 'jsonb', nullable: true })
  metrics: {
    requestsPerSecond?: number;
    errorRate?: number;
    p50ResponseTime?: number;
    p95ResponseTime?: number;
    p99ResponseTime?: number;
    bytesIn?: number;
    bytesOut?: number;
  };

  @Column({ type: 'uuid', nullable: true })
  clusterId: string;

  @Column({ type: 'jsonb', nullable: true })
  tags: Record<string, string>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => ContainerCluster, (cluster) => cluster.loadBalancers, { nullable: true })
  @JoinColumn({ name: 'clusterId' })
  cluster: ContainerCluster;
}
