import { Inject, Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';
import { RunbookExecution, RunbookExecutionStatus } from '../entities/runbook-execution.entity';
import { Incident } from '../entities/incident.entity';
import { SESSION_REDIS_CLIENT } from '../../session/session.constants';

export interface RunbookStep {
  stepNumber: number;
  stepName: string;
  action: string;
  description: string;
  autoRemediate?: boolean;
}

export interface RunbookDefinition {
  name: string;
  title: string;
  description: string;
  severity: string;
  steps: RunbookStep[];
}

@Injectable()
export class RunbookExecutionService {
  private readonly logger = new Logger(RunbookExecutionService.name);
  private runbooksPath = path.join(process.cwd(), 'dr', 'runbooks');

  constructor(
    @InjectRepository(RunbookExecution)
    private runbookExecutionRepository: Repository<RunbookExecution>,
    @Inject(SESSION_REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private lockKey(incidentId: string, runbookName: string): string {
    return `runbook:lock:${incidentId}:${runbookName}`;
  }

  private checkpointKey(executionId: string): string {
    return `runbook:checkpoint:${executionId}`;
  }

  private async acquireLock(
    incidentId: string,
    runbookName: string,
    ttlSeconds = 300,
  ): Promise<boolean> {
    const key = this.lockKey(incidentId, runbookName);
    const acquired = await this.redis.set(key, '1', 'NX', 'EX', ttlSeconds);
    return acquired === 'OK';
  }

  private async releaseLock(incidentId: string, runbookName: string): Promise<void> {
    const key = this.lockKey(incidentId, runbookName);
    await this.redis.del(key);
  }

  private async getCompletedSteps(executionId: string): Promise<Set<number>> {
    const key = this.checkpointKey(executionId);
    const raw = await this.redis.smembers(key);
    return new Set(raw.map(Number));
  }

  private async markStepCompleted(executionId: string, stepNumber: number): Promise<void> {
    const key = this.checkpointKey(executionId);
    await this.redis.sadd(key, stepNumber.toString());
    await this.redis.expire(key, 86400); // 24h TTL for checkpoint data
  }

  /**
   * Execute a runbook for an incident with idempotency and concurrency locking.
   */
  async executeRunbook(incident: Incident, runbookName: string): Promise<RunbookExecution> {
    this.logger.log(`Starting runbook execution: ${runbookName} for incident ${incident.id}`);

    // Attempt distributed lock — reject if another execution is in progress
    const locked = await this.acquireLock(incident.id, runbookName);
    if (!locked) {
      throw new Error(
        `Runbook "${runbookName}" is already executing for incident ${incident.id}. Concurrent execution rejected.`,
      );
    }

    // Load any prior partial execution for this incident+runbook to resume from checkpoints
    const priorExecution = await this.runbookExecutionRepository.findOne({
      where: {
        incidentId: incident.id,
        runbookName,
        status: RunbookExecutionStatus.PARTIALLY_COMPLETED,
      },
      order: { startedAt: 'DESC' },
    });

    let execution: RunbookExecution;
    if (priorExecution) {
      execution = priorExecution;
      execution.status = RunbookExecutionStatus.RUNNING;
      await this.runbookExecutionRepository.save(execution);
      this.logger.log(`Resuming prior execution ${execution.id}`);
    } else {
      execution = this.runbookExecutionRepository.create({
        incidentId: incident.id,
        runbookName,
        runbookPath: path.join(this.runbooksPath, `${runbookName}.md`),
        status: RunbookExecutionStatus.RUNNING,
        startedAt: new Date(),
        stepExecutions: [],
      });
      execution = await this.runbookExecutionRepository.save(execution);
    }

    try {
      const runbook = await this.parseRunbook(runbookName);
      if (!runbook) {
        throw new Error(`Runbook not found: ${runbookName}`);
      }

      const completedSteps = await this.getCompletedSteps(execution.id);
      const stepExecutions = (execution.stepExecutions as any[]) || [];
      let allSuccess = true;

      for (const step of runbook.steps) {
        // Resume: skip steps already checkpointed
        if (completedSteps.has(step.stepNumber)) {
          this.logger.log(`Step ${step.stepNumber} already completed, skipping`);
          continue;
        }

        const stepExecution: {
          stepNumber: number;
          stepName: string;
          status: 'in_progress' | 'completed' | 'failed';
          output?: string;
          error?: string;
        } = {
          stepNumber: step.stepNumber,
          stepName: step.stepName,
          status: 'in_progress',
        };

        try {
          this.logger.log(`Executing step ${step.stepNumber}: ${step.stepName}`);
          const result = await this.executeStep(step);

          stepExecution.status = result.success ? 'completed' : 'failed';
          stepExecution.output = result.output;
          if (!result.success) {
            stepExecution.error = result.error;
            allSuccess = false;
          } else {
            await this.markStepCompleted(execution.id, step.stepNumber);
          }

          this.logger.log(`Step ${step.stepNumber} completed: ${stepExecution.status}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          stepExecution.status = 'failed';
          stepExecution.error = errorMsg;
          allSuccess = false;
          this.logger.error(`Step ${step.stepNumber} failed: ${errorMsg}`);
        }

        stepExecutions.push(stepExecution);
      }

      execution.status = allSuccess
        ? RunbookExecutionStatus.COMPLETED
        : RunbookExecutionStatus.PARTIALLY_COMPLETED;
      execution.stepExecutions = stepExecutions;
      execution.completedAt = new Date();
      execution.executionSummary = `Executed ${stepExecutions.length} steps: ${allSuccess ? 'All successful' : 'Some failed'}`;
      this.logger.log(`Runbook execution completed: ${execution.status}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      execution.status = RunbookExecutionStatus.FAILED;
      execution.completedAt = new Date();
      execution.errorDetails = errorMsg;
      this.logger.error(`Runbook execution failed: ${errorMsg}`);
    }

    await this.releaseLock(incident.id, runbookName);
    return this.runbookExecutionRepository.save(execution);
  }

  /**
   * Execute a single runbook step
   */
  private async executeStep(step: RunbookStep): Promise<{
    success: boolean;
    output: string;
    error?: string;
  }> {
    try {
      // Simulate step execution based on action
      const result = await this.simulateStepAction(step.action, step.stepName);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: 'Step execution failed',
        error: errorMsg,
      };
    }
  }

  /**
   * Simulate step action execution
   */
  private async simulateStepAction(
    action: string,
    stepName: string,
  ): Promise<{ success: boolean; output: string; error?: string }> {
    // Simulate different step actions
    const actions: Record<
      string,
      () => Promise<{ success: boolean; output: string; error?: string }>
    > = {
      check_status: async () => ({
        success: true,
        output: `Status check completed for ${stepName}`,
      }),
      restart_service: async () => ({
        success: true,
        output: `Service restarted successfully for ${stepName}`,
      }),
      scale_replicas: async () => ({
        success: true,
        output: `Replicas scaled up for ${stepName}`,
      }),
      verify_connectivity: async () => ({
        success: true,
        output: `Connectivity verified for ${stepName}`,
      }),
      run_query: async () => ({
        success: true,
        output: `Query executed successfully for ${stepName}`,
      }),
      notify_team: async () => ({
        success: true,
        output: `Team notified for ${stepName}`,
      }),
    };

    const executor = actions[action];
    if (!executor) {
      return {
        success: false,
        output: `Unknown action type: ${action}`,
        error: `Action not supported: ${action}`,
      };
    }

    return executor();
  }

  /**
   * Parse runbook markdown file
   */
  private async parseRunbook(runbookName: string): Promise<RunbookDefinition | null> {
    try {
      const runbookPath = path.join(this.runbooksPath, `${runbookName}.md`);

      // Check if file exists
      if (!fs.existsSync(runbookPath)) {
        this.logger.warn(`Runbook file not found: ${runbookPath}`);
        return this.getDefaultRunbookDefinition(runbookName);
      }

      // Read and parse markdown file
      const content = fs.readFileSync(runbookPath, 'utf-8');
      const runbook = this.parseMarkdownRunbook(content, runbookName);

      return runbook;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error parsing runbook: ${errorMsg}`);
      return this.getDefaultRunbookDefinition(runbookName);
    }
  }

  /**
   * Parse markdown runbook content
   */
  private parseMarkdownRunbook(content: string, runbookName: string): RunbookDefinition {
    const lines = content.split('\n');
    const steps: RunbookStep[] = [];
    let stepNumber = 1;

    // Parse markdown headers and steps
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for step headers (### Step or ##)
      if (line.startsWith('## ') || line.startsWith('### Step')) {
        const stepName = line
          .replace(/^#+\s*/, '')
          .replace(/Step\s*\d+:\s*/i, '')
          .trim();

        if (stepName) {
          steps.push({
            stepNumber,
            stepName,
            action: this.inferActionFromDescription(stepName),
            description: stepName,
          });
          stepNumber++;
        }
      }
    }

    return {
      name: runbookName,
      title: `${runbookName.replace(/-/g, ' ')} Runbook`,
      description: `Automated runbook for ${runbookName}`,
      severity: 'critical',
      steps: steps.length > 0 ? steps : this.getDefaultSteps(runbookName),
    };
  }

  /**
   * Infer action type from step description
   */
  private inferActionFromDescription(description: string): string {
    const lowerDesc = description.toLowerCase();

    if (lowerDesc.includes('check') || lowerDesc.includes('verify')) return 'check_status';
    if (lowerDesc.includes('restart')) return 'restart_service';
    if (lowerDesc.includes('scale')) return 'scale_replicas';
    if (lowerDesc.includes('connectivity') || lowerDesc.includes('connect'))
      return 'verify_connectivity';
    if (lowerDesc.includes('query') || lowerDesc.includes('database') || lowerDesc.includes('run'))
      return 'run_query';
    if (lowerDesc.includes('notify') || lowerDesc.includes('alert')) return 'notify_team';

    return 'check_status';
  }

  /**
   * Get default steps for a runbook
   */
  private getDefaultSteps(runbookName: string): RunbookStep[] {
    const stepTemplates: Record<string, RunbookStep[]> = {
      'database-failure': [
        {
          stepNumber: 1,
          stepName: 'Check Database Connectivity',
          action: 'verify_connectivity',
          description: 'Verify database connection status',
        },
        {
          stepNumber: 2,
          stepName: 'Check Query Performance',
          action: 'check_status',
          description: 'Monitor slow queries',
        },
        {
          stepNumber: 3,
          stepName: 'Run Database Maintenance',
          action: 'run_query',
          description: 'Execute VACUUM and ANALYZE',
        },
        {
          stepNumber: 4,
          stepName: 'Verify Resolution',
          action: 'verify_connectivity',
          description: 'Confirm database recovery',
        },
      ],
      'region-outage': [
        {
          stepNumber: 1,
          stepName: 'Check Region Status',
          action: 'check_status',
          description: 'Verify AWS region availability',
        },
        {
          stepNumber: 2,
          stepName: 'Initiate Failover',
          action: 'restart_service',
          description: 'Start failover to backup region',
        },
        {
          stepNumber: 3,
          stepName: 'Verify Traffic Routing',
          action: 'verify_connectivity',
          description: 'Confirm traffic routed to backup region',
        },
      ],
      'data-corruption': [
        {
          stepNumber: 1,
          stepName: 'Detect Data Inconsistency',
          action: 'check_status',
          description: 'Run data integrity checks',
        },
        {
          stepNumber: 2,
          stepName: 'Identify Affected Records',
          action: 'run_query',
          description: 'Query corrupted data',
        },
        {
          stepNumber: 3,
          stepName: 'Restore from Backup',
          action: 'run_query',
          description: 'Point-in-time recovery',
        },
        {
          stepNumber: 4,
          stepName: 'Verify Data Integrity',
          action: 'check_status',
          description: 'Confirm data restored correctly',
        },
      ],
    };

    return (
      stepTemplates[runbookName] || [
        {
          stepNumber: 1,
          stepName: 'Check Status',
          action: 'check_status',
          description: 'Initial status check',
        },
        {
          stepNumber: 2,
          stepName: 'Execute Remediation',
          action: 'restart_service',
          description: 'Apply corrective action',
        },
        {
          stepNumber: 3,
          stepName: 'Verify Resolution',
          action: 'verify_connectivity',
          description: 'Verify problem is resolved',
        },
      ]
    );
  }

  /**
   * Get default runbook definition
   */
  private getDefaultRunbookDefinition(runbookName: string): RunbookDefinition | null {
    const knownRunbooks = Object.keys({
      'database-failure': true,
      'region-outage': true,
      'data-corruption': true,
    });
    if (!knownRunbooks.includes(runbookName)) {
      return null;
    }
    return {
      name: runbookName,
      title: `${runbookName.replace(/-/g, ' ')} Runbook`,
      description: `Automated runbook for ${runbookName}`,
      severity: 'critical',
      steps: this.getDefaultSteps(runbookName),
    };
  }

  /**
   * Get runbook execution by ID
   */
  async getRunbookExecutionById(executionId: string): Promise<RunbookExecution | null> {
    return this.runbookExecutionRepository.findOne({ where: { id: executionId } });
  }

  /**
   * Get runbook executions for an incident
   */
  async getRunbookExecutionsForIncident(incidentId: string): Promise<RunbookExecution[]> {
    return this.runbookExecutionRepository.find({
      where: { incidentId },
      order: { startedAt: 'DESC' },
    });
  }

  /**
   * List available runbooks
   */
  async listAvailableRunbooks(): Promise<string[]> {
    try {
      if (!fs.existsSync(this.runbooksPath)) {
        this.logger.warn(`Runbooks directory not found: ${this.runbooksPath}`);
        return ['database-failure', 'region-outage', 'data-corruption'];
      }

      const files = fs.readdirSync(this.runbooksPath);
      return files.filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error listing runbooks: ${errorMsg}`);
      return ['database-failure', 'region-outage', 'data-corruption'];
    }
  }
}
