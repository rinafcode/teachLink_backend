/**
 * Database Sharding Module - Exports
 *
 * Comprehensive database sharding implementation including:
 * - Shard routing with consistent hashing
 * - Data distribution across multiple shards
 * - Cross-shard query coordination
 * - Shard-aware connection management
 * - Transaction management across shards
 * - Shard management and monitoring utilities
 */

export { ShardingModule } from './sharding.module';

// Configuration
export { shardConfig } from './config/shard.config';
export type { ShardConfig, ShardGroupConfig, ShardingConfig } from './config/shard.config';

// Hash Ring
export { ShardHash } from './hash/shard.hash';

// Router
export { ShardRouter } from './router/shard.router';

// Data Source Manager
export { ShardDataSourceManager } from './datasource/shard-datasource.manager';

// Query Runner
export { ShardAwareQueryRunner } from './runner/shard-aware-query-runner';

// Query Coordinator
export { CrossShardQueryCoordinator } from './coordinator/cross-shard-query-coordinator';

// Transaction Service
export { ShardTransactionService } from './shard-transaction.service';

// Management Service
export { ShardManagementService } from './services/shard-management.service';

// Decorators
export { ShardAware, ShardKey } from './decorators/shard-aware.decorator';
export { extractShardKey } from './decorators/shard-aware.decorator';

// Repository Base
export { ShardAwareRepository } from './repository/shard-aware-repository';

// Constants
export * from './constants/shard.constants';
