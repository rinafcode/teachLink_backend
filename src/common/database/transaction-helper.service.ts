import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Transaction helper utilities
 */
@Injectable()
export class TransactionHelperService {
  private readonly logger = new Logger(TransactionHelperService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Execute multiple operations in a single transaction
   * Useful for complex business operations
   */
  async executeInTransaction<T>(
    operations: Array<(manager: EntityManager) => Promise<T>>,
  ): Promise<T[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.debug(`Starting transaction with ${operations.length} operations`);
      const results = await Promise.all(
        operations.map((operation) => operation(queryRunner.manager)),
      );
      await queryRunner.commitTransaction();
      this.logger.debug('Transaction committed successfully');
      return results;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Transaction rolled back:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute operations with conditional logic
   */
  async executeWithRollback<T>(
    operations: Array<{
      operation: (manager: EntityManager) => Promise<T>;
      rollback?: (manager: EntityManager) => Promise<void>;
      condition?: () => boolean;
    }>,
  ): Promise<T[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results: T[] = [];

      for (const { operation, rollback, condition } of operations) {
        if (condition && !condition()) {
          this.logger.debug('Skipping operation due to condition');
          continue;
        }

        const result = await operation(queryRunner.manager);
        results.push(result);

        // Store rollback function if provided
        if (rollback) {
          // In a real implementation, you'd store rollback functions
          // This is a simplified version
        }
      }

      await queryRunner.commitTransaction();
      this.logger.debug(`Transaction committed with ${results.length} operations`);
      return results;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Transaction rolled back:', error);

      // Execute rollback functions if available
      for (const { rollback } of operations) {
        if (rollback) {
          try {
            await rollback(queryRunner.manager);
          } catch (rollbackError) {
            this.logger.error('Rollback operation failed:', rollbackError);
          }
        }
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create savepoint for nested transactions
   */
  async createSavepoint(manager: EntityManager, savepointName: string): Promise<void> {
    await manager.query(`SAVEPOINT ${savepointName}`);
    this.logger.debug(`Created savepoint: ${savepointName}`);
  }

  /**
   * Rollback to savepoint
   */
  async rollbackToSavepoint(manager: EntityManager, savepointName: string): Promise<void> {
    await manager.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
    this.logger.debug(`Rolled back to savepoint: ${savepointName}`);
  }

  /**
   * Release savepoint
   */
  async releaseSavepoint(manager: EntityManager, savepointName: string): Promise<void> {
    await manager.query(`RELEASE SAVEPOINT ${savepointName}`);
    this.logger.debug(`Released savepoint: ${savepointName}`);
  }

  /**
   * Check if transaction is active
   */
  isInTransaction(manager: EntityManager): boolean {
    return manager.queryRunner?.isTransactionActive || false;
  }

  /**
   * Get transaction isolation level
   */
  async getIsolationLevel(manager: EntityManager): Promise<string> {
    try {
      const result = await manager.query('SHOW TRANSACTION ISOLATION LEVEL');
      return result[0]?.level || 'READ COMMITTED';
    } catch {
      return 'READ COMMITTED';
    }
  }

  /**
   * Set transaction timeout
   */
  async setTransactionTimeout(manager: EntityManager, timeoutMs: number): Promise<void> {
    await manager.query(`SET LOCK_TIMEOUT ${timeoutMs}`);
  }
}
