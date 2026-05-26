# Database Sharding Implementation - Summary

## Overview

This project implements comprehensive database sharding for the TeachLink platform, enabling horizontal scaling of the PostgreSQL database across multiple shards.

## What Was Implemented

### 1. Shard Configuration (`src/common/database/sharding/config/`)

- `shard.config.ts` - Defines shard configurations, groups, and routing strategies
- Supports multiple shards with configurable weights, connection pools, and failover
- Environment-based configuration (host, port, credentials per shard)

### 2. Consistent Hashing (`src/common/database/sharding/hash/`)

- `shard.hash.ts` - MurmurHash3-based consistent hashing with virtual nodes
- Even data distribution across shards
- Minimizes data movement when adding/removing shards
- Browser-safe implementation (no external dependencies)

### 3. Shard Routing (`src/common/database/sharding/router/`)

- `shard.router.ts` - Routes database operations to correct shards
- Supports multiple strategies: hash, range, list, composite
- Explicit key-to-shard mappings
- Shard health monitoring and automatic failover

### 4. Data Source Management (`src/common/database/sharding/datasource/`)

- `shard-datasource.manager.ts` - Manages connections to all shards
- Connection pooling per shard
- Health checks and monitoring
- Parallel query execution across shards

### 5. Cross-Shard Query Coordination (`src/common/database/sharding/coordinator/`)

- `cross-shard-query-coordinator.ts` - Coordinates queries spanning multiple shards
- Parallel execution with result aggregation
- Supports merge, union, aggregate, and first strategies
- Timeout handling and partial failure tolerance

### 6. Shard-Aware Query Runner (`src/common/database/sharding/runner/`)

- `shard-aware-query-runner.ts` - Manages transactions across multiple shards
- Two-phase commit pattern for distributed transactions
- Automatic rollback on failure

### 7. Shard Transaction Service (`src/common/database/sharding/`)

- `shard-transaction.service.ts` - Transaction management for sharded operations
- Single-shard transactions (auto-routed)
- Cross-shard distributed transactions
- Parallel operations on multiple shards

### 8. Shard-Aware Repository (`src/common/database/sharding/repository/`)

- `shard-aware-repository.ts` - Base class for shard-aware data access
- Automatic routing based on shard key
- CRUD operations with shard awareness
- Cross-shard queries

### 9. Shard Management Service (`src/common/database/sharding/services/`)

- `shard-management.service.ts` - Administrative operations for shard cluster
- Shard rebalancing and data migration
- Health monitoring
- Cluster statistics

### 10. Decorators (`src/common/database/sharding/decorators/`)

- `shard-aware.decorator.ts` - Decorators for shard-aware methods
- `ShardKey` parameter decorator
- `ShardAware` method decorator

### 11. Sharding Module (`src/common/database/sharding/sharding.module.ts`)

- Main module integrating all sharding components
- Global scope for dependency injection

### 12. Examples (`src/common/database/sharding/examples/`)

- `shard-user-repository.example.ts` - User data with tenant-based sharding
- `cross-shard-sync.example.ts` - Cross-shard synchronization
- `shard-payment.example.ts` - Payment processing across shards

### 13. Migration (`src/migrations/samples/`)

- `setup-sharding-infrastructure.migration.ts` - Database schema for shard metadata

## Key Features

### Automatic Shard Routing

```typescript
async processOrder(tenantId: string, orderData: any) {
  return this.shardTransactionService.runOnShard(
    tenantId,  // Automatically routes to correct shard
    async (manager) => {
      // Operations execute on the correct shard
      return manager.query('INSERT INTO orders ...');
    }
  );
}
```

### Cross-Shard Queries

```typescript
const stats = await this.shardTransactionService.crossShardQuery(
  'SELECT COUNT(*) as count FROM users',
  {
    allShards: true, // Query all shards
    aggregationStrategy: 'aggregate', // Sum numeric results
  },
);
```

### Distributed Transactions

```typescript
await this.shardTransactionService.runCrossShard([
  {
    shardKey: tenant1, // Routes to shard 1
    query: 'UPDATE accounts SET balance = balance - $1',
    parameters: [amount, tenant1],
  },
  {
    shardKey: tenant2, // Routes to shard 2
    query: 'UPDATE accounts SET balance = balance + $1',
    parameters: [amount, tenant2],
  },
]);
```

### Shard-Aware Repository

```typescript
class UserRepository extends ShardAwareRepository<User> {
  constructor(
    shardRouter: ShardRouter,
    dataSourceManager: ShardDataSourceManager,
    queryCoordinator: CrossShardQueryCoordinator,
  ) {
    super(shardRouter, dataSourceManager, queryCoordinator, 'users');
  }

  async findByTenant(tenantId: string) {
    // Automatically routes to correct shard
    return this.findAllOnShard(this.shardRouter.route(tenantId));
  }
}
```

## Configuration

### Environment Variables

```bash
# Sharding Strategy
SHARDING_STRATEGY=key-based
SHARDING_KEY_FIELD=tenantId
SHARDING_HASH_ALGORITHM=murmur3
SHARDING_VIRTUAL_NODES=150
SHARDING_DEFAULT_SHARD=shard_00

# Shard 0 (Primary)
SHARD_00_HOST=localhost
SHARD_00_PORT=5432
SHARD_00_NAME=teachlink_shard_00
SHARD_00_USER=postgres
SHARD_00_PASSWORD=postgres
SHARD_00_POOL_MAX=30
SHARD_00_POOL_MIN=5

# Shard 1
SHARD_01_HOST=localhost
SHARD_01_PORT=5433
SHARD_01_NAME=teachlink_shard_01
# ...

# Shard 2
SHARD_02_HOST=localhost
SHARD_02_PORT=5434
SHARD_02_NAME=teachlink_shard_02
# ...
```

## Testing

All sharding components have unit tests:

```bash
npm test -- src/common/database/sharding.spec.ts
```

Tests cover:

- Consistent hashing distribution
- Shard routing consistency
- Shard router operations
- Repository base class

## Architecture Benefits

1. **Horizontal Scaling**: Add shards to handle increased load
2. **Performance**: Queries route to specific shards (no full-table scans)
3. **Isolation**: Tenant data isolated by shard
4. **Availability**: Failed shards don't affect others
5. **Flexibility**: Multiple routing strategies for different use cases
6. **Observability**: Built-in health checks and metrics

## Usage Patterns

### Single-Shard Operations (Recommended)

- Use for most operations (fastest)
- Route by tenantId, userId, or other shard key
- Automatic routing via `runOnShard()`

### Cross-Shard Queries (When Necessary)

- Use for global statistics, reporting
- Slower but necessary for aggregate data
- Use `crossShardQuery()` with aggregation

### Cross-Shard Transactions (Rare)

- Use for operations spanning tenants
- Most expensive (distributed)
- Use `runCrossShard()` for atomicity

## Integration

The sharding module integrates seamlessly with existing code:

```typescript
import { ShardingModule } from './common/database/sharding/sharding.module';

@Module({
  imports: [
    DatabaseModule, // Existing transaction management
    ShardingModule, // Adds sharding capabilities
  ],
})
export class AppModule {}
```

Both systems can be used together - sharding adds routing on top of existing transaction management.

## Files Changed

- **New**: `src/common/database/sharding/` (complete sharding implementation)
- **Modified**: `src/common/database/database.module.ts` (exports sharding module)
- **New**: `test/common/database/sharding.spec.ts` (unit tests)
- **New**: `src/migrations/samples/setup-sharding-infrastructure.migration.ts` (shard metadata tables)

## Production Considerations

1. **Backup Strategy**: Backup each shard independently
2. **Monitoring**: Monitor shard health and distribution
3. **Rebalancing**: Plan for shard rebalancing as data grows
4. **Connection Pools**: Tune pool sizes per shard based on load
5. **Failover**: Implement automated failover for failed shards
6. **Query Optimization**: Avoid cross-shard queries when possible
7. **Shard Key Selection**: Choose keys that distribute data evenly

## License

MIT
