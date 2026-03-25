import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';

/**
 * Transaction monitoring interface
 */
export interface TransactionMetrics {
  transactionId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'STARTED' | 'COMMITTED' | 'ROLLED_BACK';
  operations: string[];
  error?: string;
}

/**
 * Transaction Service
 * Provides robust transaction management for critical operations
 */
@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);
  private readonly activeTransactions = new Map<string, TransactionMetrics>();

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Execute operations within a transaction
   * Automatically handles commit and rollback
   */
  async runInTransaction<T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const transactionId = this.generateTransactionId();
    const startTime = new Date();
    const metrics: TransactionMetrics = {
      transactionId,
      startTime,
      status: 'STARTED',
      operations: [],
    };
    this.activeTransactions.set(transactionId, metrics);

    try {
      this.logger.debug(`Transaction ${transactionId} started`);
      this.logger.log(`Transaction ${transactionId}: Starting operation execution`);

      const result = await operation(queryRunner.manager);

      await queryRunner.commitTransaction();
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      metrics.endTime = endTime;
      metrics.duration = duration;
      metrics.status = 'COMMITTED';

      this.logger.log(`Transaction ${transactionId} committed successfully in ${duration}ms`);
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      metrics.endTime = endTime;
      metrics.duration = duration;
      metrics.status = 'ROLLED_BACK';
      metrics.error = error instanceof Error ? error.message : String(error);

      this.logger.error(`Transaction ${transactionId} rolled back after ${duration}ms:`, error);
      throw error;
    } finally {
      await queryRunner.release();
      this.logger.debug(`Transaction ${transactionId} resources released`);
    }
  }

  /**
   * Execute operations with manual transaction control
   * Useful for complex scenarios requiring custom logic
   */
  async withTransaction<T>(callback: (queryRunner: QueryRunner) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      return await callback(queryRunner);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute operations with isolation level
   */
  async runWithIsolationLevel<T>(
    isolationLevel: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE',
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      await queryRunner.startTransaction();

      this.logger.debug(`Transaction started with isolation level: ${isolationLevel}`);

      const result = await operation(queryRunner.manager);

      await queryRunner.commitTransaction();
      this.logger.debug('Transaction committed successfully');

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Transaction rolled back due to error:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute operations with retry logic
   */
  async runWithRetry<T>(
    operation: (manager: EntityManager) => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.runInTransaction(operation);
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable (deadlock, serialization failure, etc.)
        if (this.isRetryableError(error) && attempt < maxRetries) {
          this.logger.warn(
            `Transaction failed (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms...`,
          );
          await this.delay(retryDelay);
          retryDelay *= 2; // Exponential backoff
        } else {
          throw error;
        }
      }
    }

    throw lastError ?? new Error('Transaction failed');
  }

  /**
   * Execute multiple operations in parallel within a transaction
   */
  async runParallelInTransaction<T>(
    operations: Array<(manager: EntityManager) => Promise<T>>,
  ): Promise<T[]> {
    return this.runInTransaction(async (manager) => {
      return Promise.all(operations.map((op) => op(manager)));
    });
  }

  /**
   * Execute operations with savepoint support
   */
  async runWithSavepoint<T>(
    savepointName: string,
    operation: (manager: EntityManager) => Promise<T>,
    parentManager?: EntityManager,
  ): Promise<T> {
    if (parentManager) {
      // Use existing transaction with savepoint
      await parentManager.query(`SAVEPOINT ${savepointName}`);

      try {
        const result = await operation(parentManager);
        await parentManager.query(`RELEASE SAVEPOINT ${savepointName}`);
        return result;
      } catch (error) {
        await parentManager.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        throw error;
      }
    } else {
      // Create new transaction
      return this.runInTransaction(operation);
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    const retryableErrors = [
      'deadlock',
      'serialization failure',
      'could not serialize',
      'lock timeout',
      'connection',
    ];

    const errorMessage = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return retryableErrors.some((msg) => errorMessage.includes(msg));
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current transaction manager if in transaction
   */
  getCurrentManager(): EntityManager {
    return this.dataSource.manager;
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get transaction metrics
   */
  getTransactionMetrics(): TransactionMetrics[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Get active transactions count
   */
  getActiveTransactionCount(): number {
    return this.activeTransactions.size;
  }

  /**
   * Clear completed transactions
   */
  clearCompletedTransactions(): void {
    const now = new Date();
    for (const [id, metrics] of this.activeTransactions.entries()) {
      if (metrics.endTime && now.getTime() - metrics.endTime.getTime() > 300000) {
        // 5 minutes
        this.activeTransactions.delete(id);
      }
    }
  }

  /**
   * Check if currently in a transaction
   */
  isInTransaction(manager: EntityManager): boolean {
    return manager.queryRunner?.isTransactionActive || false;
  }
}
