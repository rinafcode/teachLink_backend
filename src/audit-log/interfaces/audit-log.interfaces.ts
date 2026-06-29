import { AuditAction, AuditSeverity, AuditCategory } from '../enums/audit-action.enum';
import { AuditLog } from '../audit-log.entity';

/**
 * Audit log entry data structure for logging operations
 */
export interface IAuditLogEntry {
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  category: AuditCategory;
  severity?: AuditSeverity;
  entityType?: string;
  entityId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  apiEndpoint?: string;
  httpMethod?: string;
  statusCode?: number;
  responseTimeMs?: number;
  tenantId?: string;
}

/**
 * Filters for searching audit logs
 */
export interface IAuditLogSearchFilters {
  userId?: string;
  userEmail?: string;
  actions?: AuditAction[];
  categories?: AuditCategory[];
  severities?: AuditSeverity[];
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  sessionId?: string;
  tenantId?: string;
  startDate?: Date;
  endDate?: Date;
  apiEndpoint?: string;
  httpMethod?: string;
  statusCode?: number;
}

/**
 * Paginated search results for audit logs
 */
export interface IAuditLogSearchResult {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Audit report data structure
 */
export interface IAuditReport {
  period: { start: Date; end: Date };
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsByAction: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  topUsers: Array<{ userId: string; userEmail: string; count: number }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  failedActions: Array<{ action: string; count: number }>;
}
