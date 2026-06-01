import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

type ReadConsistency = 'eventual' | 'consistent';

export interface ReadReplicaRoutingOptions {
  consistency?: ReadConsistency;
  failoverToPrimary?: boolean;
}

@Injectable()
export class ReadReplicaRoutingService {
  private readonly logger = new Logger(ReadReplicaRoutingService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Route a read through a replica by default. Use `consistency: 'consistent'`
   * when the caller must observe writes from the current request or workflow.
   */
  async read<T>(
    operation: (manager: EntityManager) => Promise<T>,
    options: ReadReplicaRoutingOptions = {},
  ): Promise<T> {
    const consistency = options.consistency ?? 'eventual';
    const mode = consistency === 'consistent' ? 'master' : 'slave';
    const failoverToPrimary = options.failoverToPrimary ?? true;

    try {
      return await this.runWithManager(operation, mode);
    } catch (error) {
      if (mode === 'slave' && failoverToPrimary) {
        this.logger.warn(
          `Replica read failed; retrying on primary for a consistent read: ${
            (error as Error).message
          }`,
        );
        return this.runWithManager(operation, 'master');
      }

      throw error;
    }
  }

  /**
   * Force primary routing for reads that must be read-after-write consistent.
   */
  async consistentRead<T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.read(operation, { consistency: 'consistent', failoverToPrimary: false });
  }

  private async runWithManager<T>(
    operation: (manager: EntityManager) => Promise<T>,
    mode: 'master' | 'slave',
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner(mode);
    await queryRunner.connect();

    try {
      return await operation(queryRunner.manager);
    } finally {
      await queryRunner.release();
    }
  }
}
