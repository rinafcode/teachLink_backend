export interface Message {
  id: string
  type: string
  source: string
  target?: string
  payload: Record<string, any>
  headers?: Record<string, string>
  metadata?: MessageMetadata
  priority?: MessagePriority
  scheduledAt?: Date
}

export interface MessageMetadata {
  traceId: string
  spanId: string
  correlationId: string
  retryCount: number
  maxRetries: number
  delay: number
  timeout: number
}

export interface Event {
  id: string
  type: string
  source: string
  data: Record<string, any>
  timestamp: Date
  version: string
  metadata?: EventMetadata
}

export interface EventMetadata {
  traceId: string
  correlationId: string
  causationId?: string
  userId?: string
  sessionId?: string
}

export interface ServiceInfo {
  serviceName: string
  serviceId: string
  version: string
  host: string
  port: number
  metadata: ServiceMetadata
  healthCheck: HealthCheckConfig
}

export interface ServiceMetadata {
  tags: string[]
  capabilities: string[]
  endpoints: ServiceEndpoint[]
  resources: ResourceInfo
}

export interface ServiceEndpoint {
  path: string
  method: string
  description: string
}

export interface ResourceInfo {
  cpu: number
  memory: number
  disk: number
}

export interface HealthCheckConfig {
  endpoint: string
  interval: number
  timeout: number
  retries: number
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeout: number
  monitoringPeriod: number
  minimumThroughput: number
}

export interface TraceContext {
  traceId: string
  spanId: string
  parentSpanId?: string
  baggage?: Record<string, string>
}

export interface MessageQueueConfig {
  defaultQueue: string
  retryQueue: string
  deadLetterQueue: string
  maxRetries: number
  retryDelay: number
  messageTimeout: number
}

export interface EventBusConfig {
  defaultTopic: string
  partitions: number
  replicationFactor: number
  retentionMs: number
}

export enum MessagePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}
