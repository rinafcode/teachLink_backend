# Database Sharding Implementation

This module implements comprehensive database sharding to scale the TeachLink platform horizontally across multiple database instances.

## Overview

Database sharding splits data across multiple database instances (shards) to:

- Distribute load and improve performance
- Enable horizontal scaling
- Isolate tenant data for security and compliance
- Handle increased data volume and throughput

## Architecture

### Components

1. **Shard Router** (`ShardRouter`)
   - Routes keys to shards using consistent hashing
   - Supports multiple routing strategies (hash, range, list, composite)
   - Manages shard weights for balanced distribution
   - Handles shard failures with configurable fallback

2. **Hash Ring** (`ShardHash`)
   - Implements consistent hashing with virtual nodes
   - Evenly distributes data across shards
   - Minimizes data movement when adding/removing shards
   - Supports multiple hash algorithms (MD5, SHA256, Murmur3, CRC32)

3. **Data Source Manager** (`ShardDataSourceManager`)
   - Manages connections to all shards
   - Creates and manages query runners per shard
   - Executes queries on specific shards
   - Handles cross-shard operations

4. **Cross-Shard Query Coordinator** (`CrossShardQueryCoordinator`)
   - Coordinates queries across multiple shards
   - Supports parallel execution with aggregation
   - Handles partial failures gracefully
   - Provides timeouts and error handling

5. **Shard Transaction Service** (`ShardTransactionService`)
   - Manages transactions on specific shards
   - Coordinates cross-shard distributed transactions
   - Implements two-phase commit pattern
   - Tracks transaction metrics

6. **Shard-Aware Repository** (`ShardAwareRepository`)
   - Base repository class for shard-aware operations
   - Provides CRUD operations with automatic routing
   - Supports both single-shard and cross-shard queries

## Configuration

### Environment Variables

```bash
# Sharding Strategy
SHARDING_STRATEGY=key-based              # key-based, range-based, directory-based
SHARDING_KEY_FIELD=tenantId             # Field used for shard routing
SHARDING_HASH_ALGORITHM=murmur3         # md5, sha256, murmur3, crc32
SHARDING_VIRTUAL_NODES=150              # Virtual nodes per shard
SHARDING_DEFAULT_SHARD=shard_00         # Fallback shard
SHARDING_FALLBACK=true                  # Enable fallback on shard failure
SHARDING_MAX_RETRIES=2                  # Max cross-shard retries
SHARDING_CACHE_ENABLED=true             # Enable result caching
SHARDING_CACHE_TTL=300                  # Cache TTL in seconds

# Shard 0 (Primary)
SHARD_00_HOST=localhost
SHARD_00_PORT=5432
SHARD_00_NAME=teachlink_shard_00
SHARD_00_USER=postgres
SHARD_00_PASSWORD=postgres
SHARD_00_POOL_MAX=30
SHARD_00_POOL_MIN=5
SHARD_00_TIMEOUT=5000
SHARD_00_RETRY_ATTEMPTS=3

# Shard 1
SHARD_01_HOST=localhost
SHARD_01_PORT=5433
SHARD_01_NAME=teachlink_shard_01
# ... (similar configuration)

# Shard 2
SHARD_02_HOST=localhost
SHARD_02_PORT=5434
SHARD_02_NAME=teachlink_shard_02
# ... (similar configuration)
```

### Shard Configuration

Each shard is defined with:

- **id**: Unique shard identifier
- **name**: Human-readable name
- **host**, **port**, **database**: Connection details
- **weight**: Relative weight for distribution (higher = more data)
- **readOnly**: Whether shard accepts writes
- **status**: active, inactive, or maintenance

### Shard Groups

Shards can be organized into groups:

- **strategy**: hash, range, list, or composite
- **replication**: Enable replication for fault tolerance
- **readFromReplicas**: Allow read operations on replica shards
- **replicaReadStrategy**: round-robin, random, least-connections

## Usage

### 1. Import the Sharding Module

```typescript
import { ShardingModule } from './common/database/sharding/sharding.module';
import { DatabaseModule } from './common/database/database.module';

@Module({
  imports: [DatabaseModule, ShardingModule],
})
export class AppModule {}
```

### 2. Inject Shard Services

```typescript
import { Injectable } from '@nestjs/common';
import { ShardTransactionService } from './common/database/sharding';
import { CrossShardQueryCoordinator } from './common/database/sharding';

@Injectable()
export class MyService {
  constructor(
    private shardTransactionService: ShardTransactionService,
    private queryCoordinator: CrossShardQueryCoordinator,
  ) {}
}
```

### 3. Execute Shard-Routed Transactions

```typescript
// Transaction routed to specific shard based on tenantId
async processOrder(tenantId: string, orderData: any) {
  return this.shardTransactionService.runOnShard(
    tenantId,  // Shard key
    async (manager: any, shardId: string) => {
      // This executes on the shard determined by tenantId

      // Create order
      const order = await manager.query(
        'INSERT INTO orders (tenant_id, data) VALUES ($1, $2) RETURNING *',
        [tenantId, orderData],
      );

      // Update inventory
      await manager.query(
        'UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2',
        [orderData.quantity, orderData.productId],
      );

      return order[0];
    },
    'primary',  // Shard group
  );
}
```

### 4. Execute Cross-Shard Queries

```typescript
// Query across all shards and aggregate results
async getGlobalStats() {
  return this.shardTransactionService.crossShardQuery(
    'SELECT COUNT(*) as count FROM users WHERE active = true',
    {
      allShards: true,                    // Query all shards
      aggregationStrategy: 'aggregate',   // Sum numeric results
    },
  );
}

// Cross-shard aggregation
async getDashboardMetrics() {
  return this.shardTransactionService.crossShardAggregate([
    {
      query: 'SELECT COUNT(*) as count FROM orders WHERE status = \'pending\'',
      mergeKey: 'pendingOrders',
    },
    {
      query: 'SELECT SUM(amount) as total FROM orders WHERE status = \'completed\'',
      mergeKey: 'revenue',
    },
  ]);
}
```

### 5. Execute Cross-Shard Transactions

```typescript
// Transaction spanning multiple shards
async transferBetweenTenants(fromTenantId: string, toTenantId: string, amount: number) {
  return this.shardTransactionService.runCrossShard([
    {
      shardKey: fromTenantId,
      operation: async (manager: any) => {
        await manager.query(
          'UPDATE accounts SET balance = balance - $1 WHERE tenant_id = $2',
          [amount, fromTenantId],
        );
      },
    },
    {
      shardKey: toTenantId,
      operation: async (manager: any) => {
        await manager.query(
          'UPDATE accounts SET balance = balance + $1 WHERE tenant_id = $2',
          [amount, toTenantId],
        );
      },
    },
  ]);
}
```

### 6. Use Shard-Aware Repository

```typescript
import { Injectable } from '@nestjs/common';
import { ShardAwareRepository } from './common/database/sharding';
import {
  ShardRouter,
  ShardDataSourceManager,
  CrossShardQueryCoordinator,
} from './common/database/sharding';

@Injectable()
export class UserRepository extends ShardAwareRepository<any> {
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

  async findAllUsers() {
    // Queries all shards and merges results
    return this.findAllCrossShard();
  }
}
```

### 7. Use Shard Key Decorator

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { ShardKey } from './common/database/sharding/decorators/shard-aware.decorator';

@Controller('orders')
export class OrderController {
  @Post()
  async createOrder(@Body() data: any, @ShardKey() shardKey: string) {
    // shardKey is extracted from the request
    // Use it to route operations
  }
}
```

## Shard Routing Strategies

### Hash-Based Routing (Default)

Distributes data evenly across all shards using consistent hashing.

```typescript
// Routes to shard based on hash of tenantId
const shardId = shardRouter.route(tenantId);
```

### Range-Based Routing

Distributes data by key ranges (useful for sequential IDs).

```typescript
// Configure in shardGroups
{
  strategy: 'range',
  shards: ['shard_00', 'shard_01', 'shard_02']
}
```

### List-Based Routing

Explicitly maps keys to shards.

```typescript
// Add explicit mapping
shardRouter.addMapping('tenant_123', 'shard_01');
```

## Monitoring and Maintenance

### Get Shard Health

```typescript
const health = await shardManagement.getClusterHealth();
// Returns: { totalShards, activeShards, inactiveShards, shardHealth: [...] }
```

### Get Shard Distribution

```typescript
const distribution = shardRouter.getDistribution();
// Returns map of shardId -> virtual node count
```

### Get Shard Statistics

```typescript
const stats = await shardManagement.getShardStats();
// Returns row counts, size, and health per shard
```

### Migrate Data Between Shards

```typescript
await shardManagement.migrateData('shard_00', 'shard_01', ['users', 'orders']);
```

### Rebalance Shard

```typescript
await shardManagement.rebalanceShards(
  'shard_00',
  'shard_01',
  'users',
  'tenant_id',
  "tenant_id < 'm'", // Filter
);
```

## Best Practices

### 1. Choose the Right Shard Key

- **Good**: tenantId, userId (evenly distributed, queryable)
- **Avoid**: timestamps, sequential IDs (create hotspots)

### 2. Keep Transactions Short

- Minimize time holding connections open
- Avoid external API calls within transactions

### 3. Minimize Cross-Shard Operations

- Design schema to minimize cross-shard queries
- Use async replication for cross-shard data

### 4. Monitor Distribution

- Regularly check shard distribution
- Rebalance when skew exceeds 20%

### 5. Handle Failures Gracefully

- Enable fallback for shard failures
- Implement retry logic with exponential backoff
- Monitor shard health continuously

### 6. Use Indexes Wisely

- Create indexes on shard key columns
- Consider local indexes per shard

## Examples

See `src/common/database/sharding/examples/` for complete working examples:

- `shard-user-repository.example.ts` - Shard-aware user repository
- `cross-shard-sync.example.ts` - Cross-shard synchronization
- `shard-payment.example.ts` - Payment processing with sharding

## Migration from Single Database

1. **Phase 1: Deploy Sharding Infrastructure**
   - Deploy new shard databases
   - Configure sharding module
   - Test in non-production

2. **Phase 2: Dual Write**
   - Write to both single DB and shards
   - Validate data consistency
   - Monitor for issues

3. **Phase 3: Migrate Existing Data**
   - Use `migrateData()` for each table
   - Validate data after migration
   - Run consistency checks

4. **Phase 4: Switch Reads**
   - Route reads to shards
   - Keep writing to single DB as backup

5. **Phase 5: Switch Writes**
   - Redirect all writes to shards
   - Monitor closely
   - Decommission single DB after validation

## Troubleshooting

### Shard Not Found

```bash
Error: Shard shard_99 not found
```

**Solution**: Verify shard configuration exists and is active.

### Cross-Shard Timeout

```bash
Error: Query timeout exceeded
```

**Solution**: Increase timeout or optimize queries.

### Uneven Distribution

```bash
One shard has 80% of data
```

**Solution**: Adjust shard weights or add more shards.

## Performance Considerations

- Virtual nodes: 100-200 per shard recommended
- Connection pool: 10-30 connections per shard
- Query timeout: Set appropriately (1-5 seconds)
- Cache TTL: 5 minutes for frequently accessed metadata

## Security

- Use SSL/TLS for inter-shard communication
- Encrypt sensitive data at rest
- Implement row-level security per shard
- Audit cross-shard access patterns

## Future Enhancements

- Automatic shard rebalancing
- Online shard splitting
- Adaptive routing based on load
- Machine learning for query optimization
- Distributed ACID transactions
