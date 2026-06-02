import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuditAction, AuditSeverity, AuditCategory, HttpMethod } from './enums/audit-action.enum';

/**
 * Immutable audit log record.
 *
 * Rows are append-only — never updated or soft-deleted. Expiry is handled
 * exclusively via `applyRetentionPolicy`, which hard-deletes rows whose
 * `retentionUntil` has passed.
 *
 * Index strategy:
 *   Composite (column + timestamp) indexes support the most common queries:
 *   "all events for user X, newest first", "all CRITICAL events this week", etc.
 *   The `retentionUntil` index supports efficient bulk-delete during retention
 *   policy runs without a full table scan.
 */
@Entity('audit_logs')
@Index(['userId', 'timestamp'])
@Index(['action', 'timestamp'])
@Index(['category', 'timestamp'])
@Index(['severity', 'timestamp'])
@Index(['entityType', 'entityId'])
@Index(['ipAddress', 'timestamp'])
@Index(['timestamp'])
@Index(['retentionUntil'])  // required for efficient retention policy deletes
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Actor ──────────────────────────────────────────────────────────────────

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ name: 'user_email', nullable: true })
  userEmail: string | null;

  // ── Event classification ───────────────────────────────────────────────────

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'enum', enum: AuditCategory })
  category: AuditCategory;

  @Column({ type: 'enum', enum: AuditSeverity, default: AuditSeverity.INFO })
  severity: AuditSeverity;

  // ── Target entity ──────────────────────────────────────────────────────────

  @Column({ name: 'entity_type', nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', nullable: true })
  entityId: string | null;

  // ── Payload ────────────────────────────────────────────────────────────────

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues: Record<string, unknown> | null;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues: Record<string, unknown> | null;

  // ── Request context ────────────────────────────────────────────────────────

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

  /** Constrained to known HTTP verbs — free strings invite silent typos. */
  @Column({ name: 'http_method', type: 'enum', enum: HttpMethod, nullable: true })
  httpMethod: HttpMethod | null;

  @Column({ name: 'status_code', nullable: true })
  statusCode: number | null;

  @Column({ name: 'response_time_ms', nullable: true })
  responseTimeMs: number | null;

  // ── Multi-tenancy ──────────────────────────────────────────────────────────

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string | null;

  // ── Timestamps ─────────────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  /**
   * Absolute expiry date for this record.
   * Null means the record is kept indefinitely (e.g. CRITICAL severity logs).
   * Indexed — see class-level @Index.
   */
  @Column({ name: 'retention_until', nullable: true })
  retentionUntil: Date | null;
}