import { JobPriority, JobStatus } from '../enums/job-priority.enum';

export interface IJobOptions {
  priority?: JobPriority;
  attempts?: number;
  backoff?: number | IBackoffOptions;
  delay?: number;
  timeout?: number;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

export interface IBackoffOptions {
  type: 'fixed' | 'exponential';
  delay: number;
}

export interface IJobMetrics {
  jobId: string;
  name: string;
  status: JobStatus;
  priority: JobPriority;
  attempts: number;
  maxAttempts: number;
  progress: number;
  createdAt: Date;
  processedAt?: Date;
  finishedAt?: Date;
  failedReason?: string;
  data: any;
}

export interface IQueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  total: number;
  throughput: number;
  avgProcessingTime: number;
}

export interface IRetryStrategy {
  maxAttempts: number;
  backoffType: 'fixed' | 'exponential';
  initialDelay: number;
  maxDelay?: number;
  multiplier?: number;
}
