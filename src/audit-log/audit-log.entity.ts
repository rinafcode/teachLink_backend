import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { AuditAction, AuditSeverity, AuditCategory } from './enums/audit-action.enum';

/**
 * Represents the audit Log entity.
 */
@Entity('audit_logs')
@Index(['userId', 'timestamp'])
@Index(['action', 'timestamp'])
@Index(['category', 'timestamp'])
@Index(['severity', 'timestamp'])
@Index(['entityType', 'entityId'])
@Index(['ipAddress'])
@Index(['timestamp'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ name: 'user_email', nullable: true })
  userEmail: string | null;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({
    type: 'enum',
    enum: AuditCategory,
  })
  category: AuditCategory;

  @Column({
    type: 'enum',
    enum: AuditSeverity,
    default: AuditSeverity.INFO,
  })
  severity: AuditSeverity;

  @Column({ name: 'entity_type', nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', nullable: true })
  entityId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues: Record<string, unknown> | null;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues: Record<string, unknown> | null;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ name: 'session_id', nullable: true })
  sessionId: string | null;

  @Column({ name: 'request_id', nullable: true })
  requestId: string | null;

  @Column({ name: 'api_endpoint', nullable: true })
  apiEndpoint: string | null;

  @Column({ name: 'http_method', nullable: true })
  httpMethod: string | null;

  @Column({ name: 'status_code', nullable: true })
  statusCode: number | null;

  @Column({ name: 'response_time_ms', nullable: true })
  responseTimeMs: number | null;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string | null;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  @Column({ name: 'retention_until', nullable: true })
  retentionUntil: Date | null;
}
