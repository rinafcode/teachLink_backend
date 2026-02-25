import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';

/**
 * Transaction Service
 * Provides robust transaction management for critical operations
 */
@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Execute operations within a transaction
   * Automatically handles commit and rollback
   */
  async runInTransaction<T>(
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.debug('Transaction started');
      
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
      this.logger.debug('Transaction resources released');
    }
  }

  /**
   * Execute operations with manual transaction control
   * Useful for complex scenarios requiring custom logic
   */
  async withTransaction<T>(
    callback: (queryRunner: QueryRunner) => Promise<T>,
  ): Promise<T> {
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
    let lastError: Error;

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

    throw lastError!;
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
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'deadlock',
      'serialization failure',
      'could not serialize',
      'lock timeout',
      'connection',
    ];

    const errorMessage = error.message?.toLowerCase() || '';
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
   * Check if currently in a transaction
   */
  isInTransaction(manager: EntityManager): boolean {
    return manager.queryRunner?.isTransactionActive || false;
  }
}
