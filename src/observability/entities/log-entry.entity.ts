import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

@Entity('log_entries')
@Index(['level', 'timestamp'])
@Index(['serviceName', 'timestamp'])
@Index(['correlationId'])
export class LogEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamp', name: 'timestamp' })
  @Index()
  timestamp: Date;

  @Column({ type: 'enum', enum: LogLevel })
  level: LogLevel;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'service_name' })
  serviceName: string;

  @Column({ name: 'module_name', nullable: true })
  moduleName: string;

  @Column({ name: 'method_name', nullable: true })
  methodName: string;

  @Column({ name: 'file_path', nullable: true })
  filePath: string;

  @Column({ name: 'line_number', nullable: true })
  lineNumber: number;

  @Column({ name: 'correlation_id', nullable: true })
  @Index()
  correlationId: string;

  @Column({ name: 'trace_id', nullable: true })
  @Index()
  traceId: string;

  @Column({ name: 'span_id', nullable: true })
  spanId: string;

  @Column({ name: 'user_id', nullable: true })
  @Index()
  userId: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId: string;

  @Column({ name: 'request_id', nullable: true })
  requestId: string;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  stackTrace: string;

  @Column({ name: 'error_code', nullable: true })
  errorCode: string;

  @Column({ name: 'error_type', nullable: true })
  errorType: string;

  @Column({ name: 'host_name', nullable: true })
  hostName: string;

  @Column({ name: 'process_id', nullable: true })
  processId: string;

  @Column({ name: 'thread_id', nullable: true })
  threadId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
