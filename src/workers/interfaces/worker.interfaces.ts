import { Job } from 'bull';

/**
 * Worker execution result interface
 */
export interface IWorkerResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  workerId: string;
  timestamp: Date;
}

/**
 * Worker metrics interface
 */
export interface IWorkerMetrics {
  workerId: string;
  workerType: string;
  jobsProcessed: number;
  jobsFailed: number;
  jobsSucceeded: number;
  averageExecutionTime: number;
  lastExecutionTime: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'idle';
  lastUpdate: Date;
}

/**
 * Worker health check result
 */
export interface IWorkerHealthCheck {
  workerId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  metrics?: IWorkerMetrics;
  lastCheck: Date;
}

/**
 * Worker pool configuration
 */
export interface IWorkerPoolConfig {
  name: string;
  concurrency: number;
  workerCount: number;
  maxRetries: number;
  timeout: number;
  healthCheckInterval: number;
}

/**
 * Worker instance interface
 */
export interface IWorker {
  id: string;
  type: string;
  status: 'idle' | 'processing' | 'paused' | 'stopped';
  currentJob?: Job;
  processingCount: number;
  totalJobsProcessed: number;
  createdAt: Date;
  lastActivityAt: Date;
}

/**
 * Task scheduler result
 */
export interface IScheduledTaskResult {
  taskId: string;
  scheduledTime: Date;
  executedTime?: Date;
  status: 'scheduled' | 'executing' | 'completed' | 'failed';
  result?: IWorkerResult;
  error?: string;
}
