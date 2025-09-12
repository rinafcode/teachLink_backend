import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
  BUSINESS = 'business',
}

@Entity('metric_entries')
@Index(['metricName', 'timestamp'])
@Index(['serviceName', 'metricType'])
@Index(['timestamp'])
export class MetricEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamp', name: 'timestamp' })
  @Index()
  timestamp: Date;

  @Column({ name: 'metric_name' })
  metricName: string;

  @Column({ name: 'metric_type', type: 'enum', enum: MetricType })
  metricType: MetricType;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  value: number;

  @Column({ name: 'service_name' })
  serviceName: string;

  @Column({ name: 'module_name', nullable: true })
  moduleName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  tags: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  labels: Record<string, string>;

  @Column({ name: 'correlation_id', nullable: true })
  correlationId: string;

  @Column({ name: 'trace_id', nullable: true })
  traceId: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  unit: string;

  @Column({
    name: 'sample_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 1.0,
  })
  sampleRate: number;

  @Column({ type: 'jsonb', nullable: true })
  buckets: number[];

  @Column({ type: 'jsonb', nullable: true })
  quantiles: Record<string, number>;

  @Column({
    name: 'sum_value',
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  sumValue: number;

  @Column({ name: 'count_value', type: 'bigint', nullable: true })
  countValue: number;

  @Column({
    name: 'min_value',
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  minValue: number;

  @Column({
    name: 'max_value',
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  maxValue: number;

  @Column({
    name: 'avg_value',
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  avgValue: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
