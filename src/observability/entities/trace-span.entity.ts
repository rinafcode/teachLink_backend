import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('trace_spans')
@Index(['traceId', 'spanId'])
@Index(['serviceName', 'operationName'])
@Index(['timestamp'])
export class TraceSpan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trace_id' })
  @Index()
  traceId: string;

  @Column({ name: 'span_id' })
  spanId: string;

  @Column({ name: 'parent_span_id', nullable: true })
  parentSpanId: string;

  @Column({ name: 'service_name' })
  serviceName: string;

  @Column({ name: 'operation_name' })
  operationName: string;

  @Column({ name: 'start_time', type: 'bigint' })
  startTime: number;

  @Column({ name: 'end_time', type: 'bigint', nullable: true })
  endTime: number;

  @Column({ name: 'duration', type: 'bigint', nullable: true })
  duration: number;

  @Column({ type: 'jsonb', nullable: true })
  tags: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  logs: Array<{
    timestamp: number;
    fields: Record<string, any>;
  }>;

  @Column({ name: 'status_code', nullable: true })
  statusCode: string;

  @Column({ name: 'status_message', nullable: true })
  statusMessage: string;

  @Column({ name: 'correlation_id', nullable: true })
  @Index()
  correlationId: string;

  @Column({ name: 'user_id', nullable: true })
  @Index()
  userId: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'timestamp' })
  @Index()
  timestamp: Date;
}
