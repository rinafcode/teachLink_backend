import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AnomalySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AnomalyStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
}

export enum AnomalyType {
  PERFORMANCE = 'performance',
  ERROR_RATE = 'error_rate',
  BUSINESS_METRIC = 'business_metric',
  SECURITY = 'security',
  RESOURCE_USAGE = 'resource_usage',
  PATTERN = 'pattern',
}

@Entity('anomaly_alerts')
@Index(['severity', 'status'])
@Index(['serviceName', 'timestamp'])
@Index(['alertType', 'timestamp'])
export class AnomalyAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamp', name: 'timestamp' })
  @Index()
  timestamp: Date;

  @Column({ name: 'alert_type', type: 'enum', enum: AnomalyType })
  alertType: AnomalyType;

  @Column({ type: 'enum', enum: AnomalySeverity })
  severity: AnomalySeverity;

  @Column({ type: 'enum', enum: AnomalyStatus, default: AnomalyStatus.OPEN })
  status: AnomalyStatus;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'service_name' })
  serviceName: string;

  @Column({ name: 'module_name', nullable: true })
  moduleName: string;

  @Column({ name: 'metric_name', nullable: true })
  metricName: string;

  @Column({
    name: 'threshold_value',
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  thresholdValue: number;

  @Column({
    name: 'actual_value',
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  actualValue: number;

  @Column({
    name: 'deviation_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  deviationPercentage: number;

  @Column({
    name: 'confidence_score',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  confidenceScore: number;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'correlation_id', nullable: true })
  correlationId: string;

  @Column({ name: 'trace_id', nullable: true })
  traceId: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId: string;

  @Column({ name: 'detection_algorithm', nullable: true })
  detectionAlgorithm: string;

  @Column({ name: 'detection_model', nullable: true })
  detectionModel: string;

  @Column({ name: 'baseline_period', nullable: true })
  baselinePeriod: string;

  @Column({ name: 'alert_rule_id', nullable: true })
  alertRuleId: string;

  @Column({ name: 'notification_sent', type: 'boolean', default: false })
  notificationSent: boolean;

  @Column({ name: 'acknowledged_by', nullable: true })
  acknowledgedBy: string;

  @Column({ name: 'acknowledged_at', type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @Column({ name: 'resolved_by', nullable: true })
  resolvedBy: string;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
