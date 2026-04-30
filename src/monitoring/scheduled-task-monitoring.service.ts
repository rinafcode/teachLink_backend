import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertingService } from './alerting/alerting.service';
import { TIME } from '../common/constants/time.constants';

export type ScheduledTaskStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMED_OUT';

export interface IScheduledTaskConfig {
  expectedIntervalMs: number;
  timeoutMs: number;
  maxRetries?: number;
  missedExecutionGraceMs?: number;
}

export interface IScheduledTaskExecution {
  executionId: string;
  taskName: string;
  status: ScheduledTaskStatus;
  startedAt: Date;
  endedAt?: Date;
  durationMs?: number;
  errorMessage?: string;
  attempt?: number;
  maxRetries?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Provides scheduled Task Monitoring operations.
 */
@Injectable()
export class ScheduledTaskMonitoringService {
  private readonly logger = new Logger(ScheduledTaskMonitoringService.name);
  private readonly historyLimitPerTask = 50;

  private readonly taskConfigs = new Map<string, IScheduledTaskConfig>();
  private readonly activeExecutions = new Map<string, IScheduledTaskExecution>();
  private readonly executionHistory = new Map<string, IScheduledTaskExecution[]>();
  private readonly retryStats = new Map<string, { totalRetries: number; lastRetryAt?: Date }>();
  private readonly lastMissedAlertAt = new Map<string, Date>();
  private readonly taskRegisteredAt = new Map<string, Date>();

  constructor(private readonly alertingService: AlertingService) {}

  registerTask(taskName: string, config: IScheduledTaskConfig): void {
    if (!this.taskRegisteredAt.has(taskName)) {
      this.taskRegisteredAt.set(taskName, new Date());
    }

    this.taskConfigs.set(taskName, {
      ...config,
      maxRetries: config.maxRetries ?? 0,
      missedExecutionGraceMs: config.missedExecutionGraceMs ?? TIME.ONE_MINUTE_MS,
    });
  }

  /**
   * Starts execution.
   * @param taskName The task name.
   * @param config The config.
   * @param metadata The data to process.
   * @returns The resulting string value.
   */
  startExecution(
    taskName: string,
    config: IScheduledTaskConfig,
    metadata: Record<string, unknown> = {},
  ): string {
    this.registerTask(taskName, config);

    const executionId = `${taskName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const execution: IScheduledTaskExecution = {
      executionId,
      taskName,
      status: 'RUNNING',
      startedAt: new Date(),
      maxRetries: this.taskConfigs.get(taskName)?.maxRetries,
      metadata,
    };

    this.activeExecutions.set(executionId, execution);
    this.pushHistory(taskName, execution);
    this.logger.debug(`Started scheduled task execution: ${taskName} (${executionId})`);

    return executionId;
  }

  /**
   * Marks success.
   * @param executionId The execution identifier.
   * @param metadata The data to process.
   */
  markSuccess(executionId: string, metadata: Record<string, unknown> = {}): void {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return;
    }

    execution.endedAt = new Date();
    execution.durationMs = execution.endedAt.getTime() - execution.startedAt.getTime();
    execution.status = 'SUCCESS';
    execution.metadata = {
      ...(execution.metadata || {}),
      ...metadata,
    };

    this.activeExecutions.delete(executionId);

    this.alertingService.sendAlert(
      'SCHEDULED_TASK_SUCCESS',
      `Task ${execution.taskName} completed successfully in ${execution.durationMs}ms`,
      'INFO',
    );
  }

  /**
   * Marks failure.
   * @param executionId The execution identifier.
   * @param error The error.
   * @param metadata The data to process.
   */
  markFailure(
    executionId: string,
    error: Error | string,
    metadata: Record<string, unknown> = {},
  ): void {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return;
    }

    const errorMessage = typeof error === 'string' ? error : error.message;

    execution.endedAt = new Date();
    execution.durationMs = execution.endedAt.getTime() - execution.startedAt.getTime();
    execution.status = 'FAILED';
    execution.errorMessage = errorMessage;
    execution.metadata = {
      ...(execution.metadata || {}),
      ...metadata,
    };

    this.activeExecutions.delete(executionId);

    this.alertingService.sendAlert(
      'SCHEDULED_TASK_FAILURE',
      `Task ${execution.taskName} failed: ${errorMessage}`,
      'CRITICAL',
    );
  }

  /**
   * Records retry.
   * @param taskName The task name.
   * @param attempt The attempt.
   * @param maxRetries The max retries.
   * @param reason The reason.
   */
  recordRetry(taskName: string, attempt: number, maxRetries: number, reason?: string): void {
    const current = this.retryStats.get(taskName) || { totalRetries: 0 };
    current.totalRetries += 1;
    current.lastRetryAt = new Date();
    this.retryStats.set(taskName, current);

    this.alertingService.sendAlert(
      'SCHEDULED_TASK_RETRY',
      `Task ${taskName} retry attempt ${attempt}/${maxRetries}${reason ? `: ${reason}` : ''}`,
      'WARNING',
    );
  }

  /**
   * Executes monitor Scheduled Tasks.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  monitorScheduledTasks(): void {
    const now = new Date();

    for (const [executionId, execution] of this.activeExecutions.entries()) {
      const config = this.taskConfigs.get(execution.taskName);
      if (!config) {
        continue;
      }

      const elapsedMs = now.getTime() - execution.startedAt.getTime();
      if (elapsedMs > config.timeoutMs) {
        execution.endedAt = now;
        execution.durationMs = elapsedMs;
        execution.status = 'TIMED_OUT';
        execution.errorMessage = `Execution exceeded timeout of ${config.timeoutMs}ms`;

        this.activeExecutions.delete(executionId);

        this.alertingService.sendAlert(
          'SCHEDULED_TASK_TIMEOUT',
          `Task ${execution.taskName} exceeded timeout (${elapsedMs}ms)`,
          'CRITICAL',
        );
      }
    }

    for (const [taskName, config] of this.taskConfigs.entries()) {
      const history = this.executionHistory.get(taskName) || [];
      const latest = history[history.length - 1];

      const baseline = latest?.startedAt || this.taskRegisteredAt.get(taskName);
      if (!baseline) {
        continue;
      }

      const elapsedSinceStart = now.getTime() - baseline.getTime();
      const threshold = config.expectedIntervalMs + (config.missedExecutionGraceMs || 0);
      const isOverdue = elapsedSinceStart > threshold;
      const alreadyAlertedAt = this.lastMissedAlertAt.get(taskName);
      const shouldAlertAgain =
        !alreadyAlertedAt || now.getTime() - alreadyAlertedAt.getTime() > config.expectedIntervalMs;

      if (isOverdue && shouldAlertAgain) {
        this.lastMissedAlertAt.set(taskName, now);
        this.alertingService.sendAlert(
          'SCHEDULED_TASK_MISSED',
          `Task ${taskName} appears delayed/missed. Last start was ${baseline.toISOString()}`,
          'CRITICAL',
        );
      }
    }
  }

  /**
   * Retrieves dashboard.
   * @returns The operation result.
   */
  getDashboard() {
    const now = new Date();

    const tasks = Array.from(this.taskConfigs.entries()).map(([taskName, config]) => {
      const history = this.executionHistory.get(taskName) || [];
      const lastExecution = history[history.length - 1] || null;
      const lastSuccess =
        [...history].reverse().find((entry) => entry.status === 'SUCCESS') || null;
      const lastFailure =
        [...history]
          .reverse()
          .find((entry) => entry.status === 'FAILED' || entry.status === 'TIMED_OUT') || null;
      const activeCount = Array.from(this.activeExecutions.values()).filter(
        (entry) => entry.taskName === taskName,
      ).length;

      const threshold = config.expectedIntervalMs + (config.missedExecutionGraceMs || 0);
      const missed =
        !!lastExecution &&
        now.getTime() - lastExecution.startedAt.getTime() > threshold &&
        activeCount === 0;

      const retryStats = this.retryStats.get(taskName) || { totalRetries: 0 };

      return {
        taskName,
        config,
        activeCount,
        missed,
        lastExecution,
        lastSuccessAt: lastSuccess?.endedAt || null,
        lastFailureAt: lastFailure?.endedAt || null,
        retry: retryStats,
        recentHistory: history.slice(-10),
      };
    });

    return {
      generatedAt: now,
      summary: {
        taskCount: tasks.length,
        activeExecutions: this.activeExecutions.size,
        tasksWithMissedExecutions: tasks.filter((task) => task.missed).length,
        tasksWithRecentFailures: tasks.filter(
          (task) =>
            task.lastExecution?.status === 'FAILED' || task.lastExecution?.status === 'TIMED_OUT',
        ).length,
      },
      tasks,
    };
  }

  private pushHistory(taskName: string, execution: IScheduledTaskExecution): void {
    const existing = this.executionHistory.get(taskName) || [];
    existing.push(execution);

    if (existing.length > this.historyLimitPerTask) {
      existing.splice(0, existing.length - this.historyLimitPerTask);
    }

    this.executionHistory.set(taskName, existing);
  }
}
