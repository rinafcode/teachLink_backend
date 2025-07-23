export interface SyncConfiguration {
  entityType: string
  dataSources: DataSourceConfig[]
  conflictResolution: ConflictResolutionConfig
  replication: ReplicationConfig
  caching: CachingConfig
}

export interface DataSourceConfig {
  name: string
  type: "database" | "cache" | "api" | "search"
  connection: Record<string, any>
  priority: number
  readOnly: boolean
  regions: string[]
}

export interface ConflictResolutionConfig {
  strategy: "last_write_wins" | "first_write_wins" | "merge" | "custom"
  customResolver?: string
  mergeFields?: string[]
  ignoreFields?: string[]
}

export interface ReplicationConfig {
  enabled: boolean
  regions: string[]
  batchSize: number
  maxLag: number
  retryPolicy: RetryPolicy
}

export interface CachingConfig {
  enabled: boolean
  ttl: number
  invalidationStrategy: "immediate" | "lazy" | "scheduled"
  tags: string[]
}

export interface RetryPolicy {
  maxRetries: number
  backoffStrategy: "linear" | "exponential"
  baseDelay: number
  maxDelay: number
}

export interface SyncResult {
  success: boolean
  syncedRecords: number
  conflicts: number
  errors: string[]
  duration: number
}

export interface ConflictResolutionResult {
  resolved: boolean
  strategy: string
  resolvedData: Record<string, any>
  reason: string
}

export interface IntegrityCheckResult {
  passed: boolean
  recordsChecked: number
  inconsistencies: Array<{
    entityId: string
    field: string
    expected: any
    actual: any
    sources: string[]
  }>
  warnings: string[]
}
