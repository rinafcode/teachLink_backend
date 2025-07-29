import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Container } from './container.entity';

export enum MetricType {
  CPU_USAGE = 'cpu_usage',
  MEMORY_USAGE = 'memory_usage',
  NETWORK_IO = 'network_io',
  DISK_IO = 'disk_io',
  REQUEST_COUNT = 'request_count',
  RESPONSE_TIME = 'response_time',
  ERROR_RATE = 'error_rate',
  CUSTOM = 'custom',
}

@Entity('container_metrics')
@Index(['containerId', 'metricType', 'timestamp'])
@Index(['timestamp'])
export class ContainerMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  containerId: string;

  @Column({ type: 'varchar', length: 255 })
  containerName: string;

  @Column({ type: 'varchar', length: 100, default: 'default' })
  namespace: string;

  @Column({
    type: 'enum',
    enum: MetricType,
  })
  metricType: MetricType;

  @Column({ type: 'varchar', length: 255 })
  metricName: string;

  @Column({ type: 'decimal', precision: 15, scale: 6 })
  value: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string;

  @Column({ type: 'jsonb', nullable: true })
  labels: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  dimensions: {
    podName?: string;
    nodeName?: string;
    clusterId?: string;
    zone?: string;
    region?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  cpuMetrics: {
    usagePercent?: number;
    usageCores?: number;
    requestedCores?: number;
    limitCores?: number;
    throttlingPercent?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  memoryMetrics: {
    usageBytes?: number;
    usagePercent?: number;
    requestedBytes?: number;
    limitBytes?: number;
    workingSetBytes?: number;
    availableBytes?: number;
    cacheBytes?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  networkMetrics: {
    rxBytes?: number;
    txBytes?: number;
    rxPackets?: number;
    txPackets?: number;
    rxErrors?: number;
    txErrors?: number;
    rxDropped?: number;
    txDropped?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  diskMetrics: {
    readBytes?: number;
    writeBytes?: number;
    readOperations?: number;
    writeOperations?: number;
    readLatency?: number;
    writeLatency?: number;
    utilizationPercent?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  applicationMetrics: {
    requestsPerSecond?: number;
    averageResponseTime?: number;
    p50ResponseTime?: number;
    p95ResponseTime?: number;
    p99ResponseTime?: number;
    errorRate?: number;
    httpStatus2xx?: number;
    httpStatus3xx?: number;
    httpStatus4xx?: number;
    httpStatus5xx?: number;
    activeConnections?: number;
    queueLength?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  healthMetrics: {
    livenessProbeSuccessRate?: number;
    readinessProbeSuccessRate?: number;
    restartCount?: number;
    uptime?: number;
    lastRestartReason?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  resourceUtilization: {
    cpuEfficiency?: number;
    memoryEfficiency?: number;
    networkUtilization?: number;
    diskUtilization?: number;
    overallEfficiency?: number;
  };

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  anomalyScore: number;

  @Column({ type: 'boolean', default: false })
  isAnomaly: boolean;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Container, (container) => container.metrics)
  @JoinColumn({ name: 'containerId' })
  container: Container;
}
