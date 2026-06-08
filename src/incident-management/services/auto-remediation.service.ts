import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  RemediationAction,
  RemediationStatus,
} from '../entities/remediation-action.entity';
import { Incident } from '../entities/incident.entity';

export interface RemediationHandler {
  canHandle(actionType: string): boolean;
  execute(
    parameters: Record<string, unknown>,
  ): Promise<{ success: boolean; output: string; error?: string }>;
}

/**
 * Handler for restarting services
 */
class RestartServiceHandler implements RemediationHandler {
  private readonly logger = new Logger('RestartServiceHandler');

  canHandle(actionType: string): boolean {
    return actionType === 'restart_service';
  }

  async execute(
    parameters: Record<string, unknown>,
  ): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const serviceName = parameters.serviceName as string;
      if (!serviceName) {
        throw new Error('serviceName parameter is required');
      }

      this.logger.log(`Restarting service: ${serviceName}`);

      // Simulate service restart
      const output = `Service ${serviceName} restarted successfully`;
      this.logger.log(output);

      return { success: true, output };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to restart service: ${errorMsg}`);
      return {
        success: false,
        output: 'Service restart failed',
        error: errorMsg,
      };
    }
  }
}

/**
 * Handler for clearing caches
 */
class ClearCacheHandler implements RemediationHandler {
  private readonly logger = new Logger('ClearCacheHandler');

  canHandle(actionType: string): boolean {
    return actionType === 'clear_cache';
  }

  async execute(
    parameters: Record<string, unknown>,
  ): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const cacheType = (parameters.cacheType as string) || 'all';
      this.logger.log(`Clearing cache: ${cacheType}`);

      // Simulate cache clear
      const output = `Cache (${cacheType}) cleared successfully`;
      this.logger.log(output);

      return { success: true, output };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to clear cache: ${errorMsg}`);
      return {
        success: false,
        output: 'Cache clear failed',
        error: errorMsg,
      };
    }
  }
}

/**
 * Handler for scaling resources
 */
class ScaleResourcesHandler implements RemediationHandler {
  private readonly logger = new Logger('ScaleResourcesHandler');

  canHandle(actionType: string): boolean {
    return actionType === 'scale_resources';
  }

  async execute(
    parameters: Record<string, unknown>,
  ): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const replicas = parameters.replicas as number;
      const resource = (parameters.resource as string) || 'pods';

      if (!replicas || replicas < 1) {
        throw new Error('Valid replicas count is required');
      }

      this.logger.log(`Scaling ${resource} to ${replicas} replicas`);

      // Simulate scaling
      const output = `${resource} scaled to ${replicas} replicas successfully`;
      this.logger.log(output);

      return { success: true, output };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to scale resources: ${errorMsg}`);
      return {
        success: false,
        output: 'Resource scaling failed',
        error: errorMsg,
      };
    }
  }
}

/**
 * Handler for database operations
 */
class DatabaseOperationHandler implements RemediationHandler {
  private readonly logger = new Logger('DatabaseOperationHandler');

  canHandle(actionType: string): boolean {
    return actionType === 'run_database_query';
  }

  async execute(
    parameters: Record<string, unknown>,
  ): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const operation = (parameters.operation as string) || 'vacuum';
      this.logger.log(`Running database operation: ${operation}`);

      // Simulate database operation
      const output = `Database operation (${operation}) completed successfully`;
      this.logger.log(output);

      return { success: true, output };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to run database operation: ${errorMsg}`);
      return {
        success: false,
        output: 'Database operation failed',
        error: errorMsg,
      };
    }
  }
}

@Injectable()
export class AutoRemediationService {
  private readonly logger = new Logger(AutoRemediationService.name);
  private handlers: RemediationHandler[] = [];

  constructor(
    @InjectRepository(RemediationAction)
    private remediationRepository: Repository<RemediationAction>,
  ) {
    // Register handlers
    this.handlers.push(
      new RestartServiceHandler(),
      new ClearCacheHandler(),
      new ScaleResourcesHandler(),
      new DatabaseOperationHandler(),
    );
  }

  /**
   * Create and execute a remediation action
   */
  async executeRemediationAction(
    incident: Incident,
    actionType: string,
    description: string,
    parameters: Record<string, unknown>,
    autoRollback = false,
  ): Promise<RemediationAction> {
    this.logger.log(
      `Executing remediation action: ${actionType} for incident ${incident.id}`,
    );

    // Create remediation action record
    let remediationAction = this.remediationRepository.create({
      incidentId: incident.id,
      actionType,
      description,
      parameters,
      status: RemediationStatus.IN_PROGRESS,
      autoRollback,
    });

    remediationAction = await this.remediationRepository.save(remediationAction);

    try {
      // Find handler for this action type
      const handler = this.handlers.find((h) => h.canHandle(actionType));
      if (!handler) {
        throw new Error(`No handler found for action type: ${actionType}`);
      }

      // Execute the action
      const result = await handler.execute(parameters);

      if (result.success) {
        remediationAction.status = RemediationStatus.COMPLETED;
        remediationAction.executionOutput = result.output;
        remediationAction.executedAt = new Date();
        this.logger.log(`Remediation action completed: ${actionType}`);
      } else {
        remediationAction.status = RemediationStatus.FAILED;
        remediationAction.executionOutput = result.output;
        remediationAction.errorMessage = result.error;
        remediationAction.executedAt = new Date();
        this.logger.error(
          `Remediation action failed: ${actionType} - ${result.error}`,
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      remediationAction.status = RemediationStatus.FAILED;
      remediationAction.executionOutput = 'Remediation action execution failed';
      remediationAction.errorMessage = errorMsg;
      remediationAction.executedAt = new Date();
      this.logger.error(`Error executing remediation action: ${errorMsg}`);
    }

    return this.remediationRepository.save(remediationAction);
  }

  /**
   * Rollback a remediation action
   */
  async rollbackRemediationAction(
    remediationAction: RemediationAction,
  ): Promise<void> {
    this.logger.log(
      `Rolling back remediation action: ${remediationAction.id}`,
    );

    try {
      // Determine rollback strategy based on action type
      const rollbackStrategy = this.getRollbackStrategy(
        remediationAction.actionType,
      );
      if (rollbackStrategy) {
        await rollbackStrategy(remediationAction.parameters);
        this.logger.log(`Rollback completed for action: ${remediationAction.id}`);
      }

      remediationAction.status = RemediationStatus.ROLLED_BACK;
      remediationAction.rolledBackAt = new Date();
      await this.remediationRepository.save(remediationAction);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to rollback remediation action: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Get rollback strategy for action type
   */
  private getRollbackStrategy(
    actionType: string,
  ): ((parameters: Record<string, unknown>) => Promise<void>) | null {
    const strategies: Record<
      string,
      (parameters: Record<string, unknown>) => Promise<void>
    > = {
      scale_resources: async (params) => {
        // Scale down to original replicas
        this.logger.log(
          `Rolling back resource scaling to original state`,
        );
      },
      clear_cache: async () => {
        // Re-populate cache
        this.logger.log(`Rolling back cache clear`);
      },
    };

    return strategies[actionType] || null;
  }

  /**
   * Get remediation actions for an incident
   */
  async getRemediationActions(incidentId: string): Promise<RemediationAction[]> {
    return this.remediationRepository.find({
      where: { incidentId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get remediation action by ID
   */
  async getRemediationActionById(
    remediationId: string,
  ): Promise<RemediationAction | null> {
    return this.remediationRepository.findOne({ where: { id: remediationId } });
  }

  /**
   * Suggest remediation actions for an incident
   */
  suggestRemediationActions(incidentTitle: string): Array<{
    actionType: string;
    description: string;
    parameters: Record<string, unknown>;
    autoRollback: boolean;
  }> {
    const suggestions: Array<{
      actionType: string;
      description: string;
      parameters: Record<string, unknown>;
      autoRollback: boolean;
    }> = [];

    if (incidentTitle.includes('Database')) {
      suggestions.push(
        {
          actionType: 'run_database_query',
          description: 'Run database maintenance (VACUUM)',
          parameters: { operation: 'vacuum' },
          autoRollback: false,
        },
        {
          actionType: 'restart_service',
          description: 'Restart database connection pool',
          parameters: { serviceName: 'db-connection-pool' },
          autoRollback: true,
        },
      );
    }

    if (incidentTitle.includes('Cache')) {
      suggestions.push({
        actionType: 'clear_cache',
        description: 'Clear application cache',
        parameters: { cacheType: 'all' },
        autoRollback: false,
      });
    }

    if (
      incidentTitle.includes('Resource') ||
      incidentTitle.includes('CPU') ||
      incidentTitle.includes('Memory')
    ) {
      suggestions.push({
        actionType: 'scale_resources',
        description: 'Scale up application replicas',
        parameters: { replicas: 3, resource: 'pods' },
        autoRollback: true,
      });
    }

    if (incidentTitle.includes('Error') || incidentTitle.includes('Latency')) {
      suggestions.push({
        actionType: 'restart_service',
        description: 'Restart application service',
        parameters: { serviceName: 'api-server' },
        autoRollback: true,
      });
    }

    return suggestions;
  }
}
