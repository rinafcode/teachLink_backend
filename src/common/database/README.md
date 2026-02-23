# Database Transaction Management

Robust transaction management system for ensuring data consistency in critical operations.

## Features

- **Automatic Transaction Management**: Wrap operations in transactions automatically
- **Rollback on Failure**: Automatic rollback when errors occur
- **Isolation Levels**: Support for all PostgreSQL isolation levels
- **Retry Logic**: Automatic retry on deadlocks and serialization failures
- **Savepoint Support**: Nested transactions with savepoints
- **Parallel Transactions**: Execute multiple operations in parallel within a transaction
- **Decorator Support**: Use `@Transactional()` decorator for automatic transaction wrapping

## Quick Start

### Basic Transaction

```typescript
import { Injectable } from '@nestjs/common';
import { TransactionService } from './common/database/transaction.service';

@Injectable()
export class PaymentService {
  constructor(private readonly transactionService: TransactionService) {}

  async processPayment(userId: string, amount: number) {
    return this.transactionService.runInTransaction(async (manager) => {
      // All operations within this block are atomic
      
      // Deduct from sender
      await manager.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [amount, userId],
      );

      // Create payment record
      const payment = await manager.query(
        'INSERT INTO payments (user_id, amount) VALUES ($1, $2) RETURNING *',
        [userId, amount],
      );

      // If any operation fails, everything rolls back automatically
      return payment[0];
    });
  }
}
```

## Usage Examples

### 1. Simple Transaction

```typescript
async transferMoney(fromId: string, toId: string, amount: number) {
  return this.transactionService.runInTransaction(async (manager) => {
    // Deduct from sender
    await manager.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1',
      [amount, fromId],
    );

    // Add to recipient
    await manager.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2',
      [amount, toId],
    );

    return { success: true };
  });
}
```

### 2. Transaction with Retry

Automatically retry on deadlocks or serialization failures:

```typescript
async processWithRetry(data: any) {
  return this.transactionService.runWithRetry(
    async (manager) => {
      // Your operations here
      return await this.performOperation(manager, data);
    },
    3,    // max retries
    1000, // initial delay (ms)
  );
}
```

### 3. Transaction with Isolation Level

Use specific isolation levels for concurrent operations:

```typescript
async criticalOperation(data: any) {
  return this.transactionService.runWithIsolationLevel(
    'SERIALIZABLE', // Highest isolation level
    async (manager) => {
      // Operations that require strict isolation
      return await this.performCriticalOperation(manager, data);
    },
  );
}
```

### 4. Parallel Operations in Transaction

Execute multiple independent operations in parallel:

```typescript
async batchUpdate(items: any[]) {
  const operations = items.map(item => 
    (manager) => manager.query('UPDATE items SET status = $1 WHERE id = $2', ['processed', item.id])
  );

  return this.transactionService.runParallelInTransaction(operations);
}
```

### 5. Savepoints (Nested Transactions)

Use savepoints for partial rollbacks:

```typescript
async complexOperation(data: any) {
  return this.transactionService.runInTransaction(async (manager) => {
    // Main operation
    await manager.query('INSERT INTO logs (message) VALUES ($1)', ['Started']);

    try {
      // Nested operation with savepoint
      await this.transactionService.runWithSavepoint(
        'nested_operation',
        async (mgr) => {
          // This can rollback independently
          await mgr.query('INSERT INTO temp_data (value) VALUES ($1)', [data]);
        },
        manager,
      );
    } catch (error) {
      // Savepoint rolled back, but main transaction continues
      console.log('Nested operation failed, continuing...');
    }

    // Main transaction continues
    await manager.query('INSERT INTO logs (message) VALUES ($1)', ['Completed']);
  });
}
```

## Decorator Usage

Use the `@Transactional()` decorator for automatic transaction wrapping:

```typescript
import { Injectable } from '@nestjs/common';
import { Transactional } from './common/database/transactional.decorator';

@Injectable()
export class UserService {
  // Simple transactional method
  @Transactional()
  async createUser(data: CreateUserDto) {
    // Automatically wrapped in transaction
    // Rolls back on error
  }

  // With isolation level
  @Transactional({ isolationLevel: 'SERIALIZABLE' })
  async criticalUpdate(data: any) {
    // Uses SERIALIZABLE isolation level
  }

  // With retry
  @Transactional({ retry: true, maxRetries: 3 })
  async updateWithRetry(data: any) {
    // Automatically retries on failure
  }
}
```

## Critical Operations Examples

### Payment Processing

```typescript
async processPayment(userId: string, amount: number, recipientId: string) {
  return this.transactionService.runInTransaction(async (manager) => {
    // 1. Check and lock sender's balance
    const sender = await manager.query(
      'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );

    if (sender[0].balance < amount) {
      throw new Error('Insufficient balance');
    }

    // 2. Deduct from sender
    await manager.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, userId],
    );

    // 3. Add to recipient
    await manager.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2',
      [amount, recipientId],
    );

    // 4. Create payment record
    const payment = await manager.query(
      'INSERT INTO payments (user_id, recipient_id, amount, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, recipientId, amount, 'completed'],
    );

    // 5. Create transaction log
    await manager.query(
      'INSERT INTO transaction_logs (payment_id, type) VALUES ($1, $2)',
      [payment[0].id, 'payment'],
    );

    return payment[0];
  });
}
```

### Booking System

```typescript
async bookSession(userId: string, slotId: string, amount: number) {
  return this.transactionService.runInTransaction(async (manager) => {
    // 1. Lock and check slot availability
    const slot = await manager.query(
      'SELECT * FROM slots WHERE id = $1 AND status = $2 FOR UPDATE',
      [slotId, 'available'],
    );

    if (!slot || slot.length === 0) {
      throw new Error('Slot not available');
    }

    // 2. Process payment
    await manager.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1',
      [amount, userId],
    );

    // 3. Mark slot as booked
    await manager.query(
      'UPDATE slots SET status = $1, booked_by = $2 WHERE id = $3',
      ['booked', userId, slotId],
    );

    // 4. Create booking
    const booking = await manager.query(
      'INSERT INTO bookings (user_id, slot_id, amount) VALUES ($1, $2, $3) RETURNING *',
      [userId, slotId, amount],
    );

    // 5. Send notification
    await manager.query(
      'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
      [userId, 'Booking confirmed'],
    );

    return booking[0];
  });
}
```

### DAO Voting

```typescript
async castVote(userId: string, proposalId: string, voteType: string) {
  return this.transactionService.runWithIsolationLevel(
    'SERIALIZABLE', // Prevent double voting
    async (manager) => {
      // 1. Check if already voted
      const existing = await manager.query(
        'SELECT * FROM votes WHERE user_id = $1 AND proposal_id = $2',
        [userId, proposalId],
      );

      if (existing.length > 0) {
        throw new Error('Already voted');
      }

      // 2. Record vote
      await manager.query(
        'INSERT INTO votes (user_id, proposal_id, vote_type) VALUES ($1, $2, $3)',
        [userId, proposalId, voteType],
      );

      // 3. Update vote counts
      const field = voteType === 'for' ? 'votes_for' : 'votes_against';
      await manager.query(
        `UPDATE proposals SET ${field} = ${field} + 1 WHERE id = $1`,
        [proposalId],
      );

      // 4. Check if quorum reached
      const proposal = await manager.query(
        'SELECT * FROM proposals WHERE id = $1',
        [proposalId],
      );

      const totalVotes = proposal[0].votes_for + proposal[0].votes_against;
      if (totalVotes >= proposal[0].quorum) {
        await manager.query(
          'UPDATE proposals SET quorum_reached = true WHERE id = $1',
          [proposalId],
        );
      }

      return { success: true };
    },
  );
}
```

## Isolation Levels

### READ UNCOMMITTED
Lowest isolation, allows dirty reads:
```typescript
await this.transactionService.runWithIsolationLevel(
  'READ UNCOMMITTED',
  async (manager) => {
    // Can read uncommitted changes from other transactions
  },
);
```

### READ COMMITTED (Default)
Prevents dirty reads:
```typescript
await this.transactionService.runWithIsolationLevel(
  'READ COMMITTED',
  async (manager) => {
    // Only reads committed data
  },
);
```

### REPEATABLE READ
Prevents non-repeatable reads:
```typescript
await this.transactionService.runWithIsolationLevel(
  'REPEATABLE READ',
  async (manager) => {
    // Same query returns same results throughout transaction
  },
);
```

### SERIALIZABLE
Highest isolation, prevents phantom reads:
```typescript
await this.transactionService.runWithIsolationLevel(
  'SERIALIZABLE',
  async (manager) => {
    // Complete isolation from other transactions
    // Use for critical operations like voting, payments
  },
);
```

## Error Handling

Transactions automatically rollback on errors:

```typescript
try {
  await this.transactionService.runInTransaction(async (manager) => {
    await manager.query('INSERT INTO users (name) VALUES ($1)', ['John']);
    
    // This will cause rollback
    throw new Error('Something went wrong');
    
    // This won't execute
    await manager.query('INSERT INTO logs (message) VALUES ($1)', ['Done']);
  });
} catch (error) {
  console.log('Transaction rolled back:', error.message);
  // No data was persisted
}
```

## Best Practices

1. **Keep Transactions Short**: Minimize the time a transaction is open
2. **Use Appropriate Isolation Levels**: Don't use SERIALIZABLE unless necessary
3. **Handle Deadlocks**: Use retry logic for operations prone to deadlocks
4. **Lock Order**: Always acquire locks in the same order to prevent deadlocks
5. **Use FOR UPDATE**: Lock rows you're going to update
6. **Avoid External Calls**: Don't make HTTP requests or long operations inside transactions
7. **Test Rollback Scenarios**: Ensure rollbacks work correctly
8. **Monitor Performance**: Track transaction duration and deadlock frequency

## Common Patterns

### Optimistic Locking

```typescript
async updateWithVersion(id: string, data: any, expectedVersion: number) {
  return this.transactionService.runInTransaction(async (manager) => {
    const result = await manager.query(
      'UPDATE items SET data = $1, version = version + 1 WHERE id = $2 AND version = $3 RETURNING *',
      [data, id, expectedVersion],
    );

    if (result.length === 0) {
      throw new Error('Concurrent modification detected');
    }

    return result[0];
  });
}
```

### Pessimistic Locking

```typescript
async updateWithLock(id: string, data: any) {
  return this.transactionService.runInTransaction(async (manager) => {
    // Lock the row
    const item = await manager.query(
      'SELECT * FROM items WHERE id = $1 FOR UPDATE',
      [id],
    );

    // Update
    await manager.query(
      'UPDATE items SET data = $1 WHERE id = $2',
      [data, id],
    );

    return item[0];
  });
}
```

### Batch Processing

```typescript
async processBatch(items: any[]) {
  return this.transactionService.runInTransaction(async (manager) => {
    const results = [];

    for (const item of items) {
      const result = await manager.query(
        'INSERT INTO processed_items (data) VALUES ($1) RETURNING *',
        [item],
      );
      results.push(result[0]);
    }

    return results;
  });
}
```

## Troubleshooting

### Deadlocks

If you encounter deadlocks:
1. Use retry logic
2. Ensure consistent lock ordering
3. Keep transactions short
4. Use lower isolation levels when possible

```typescript
// Good: Consistent lock order
await manager.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId1]);
await manager.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId2]);

// Bad: Inconsistent lock order (can cause deadlocks)
// Transaction A locks user1, then user2
// Transaction B locks user2, then user1
```

### Long-Running Transactions

Avoid:
```typescript
// BAD: External API call in transaction
await this.transactionService.runInTransaction(async (manager) => {
  await manager.query('INSERT INTO orders (data) VALUES ($1)', [data]);
  await this.externalApi.notify(); // DON'T DO THIS
});
```

Do instead:
```typescript
// GOOD: External call after transaction
const order = await this.transactionService.runInTransaction(async (manager) => {
  return await manager.query('INSERT INTO orders (data) VALUES ($1) RETURNING *', [data]);
});

// Call external API after transaction commits
await this.externalApi.notify(order);
```

### Transaction Timeout

Set appropriate timeouts:
```typescript
// In TypeORM configuration
{
  extra: {
    statement_timeout: 30000, // 30 seconds
  }
}
```

## Testing

### Unit Tests

```typescript
describe('PaymentService', () => {
  it('should rollback on insufficient balance', async () => {
    await expect(
      service.processPayment('user1', 1000, 'user2'),
    ).rejects.toThrow('Insufficient balance');

    // Verify no changes were made
    const user = await userRepo.findOne('user1');
    expect(user.balance).toBe(originalBalance);
  });
});
```

### Integration Tests

```typescript
describe('Transaction Integration', () => {
  it('should handle concurrent updates correctly', async () => {
    const promises = Array(10).fill(null).map(() =>
      service.incrementCounter('counter1'),
    );

    await Promise.all(promises);

    const counter = await counterRepo.findOne('counter1');
    expect(counter.value).toBe(10); // All increments succeeded
  });
});
```

## Performance Tips

1. **Use Connection Pooling**: Configure appropriate pool size
2. **Index Foreign Keys**: Ensure foreign keys are indexed
3. **Analyze Query Plans**: Use EXPLAIN to optimize queries
4. **Batch Operations**: Group multiple operations when possible
5. **Use Prepared Statements**: Reuse query plans
6. **Monitor Locks**: Track lock wait times

## Resources

- [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [TypeORM Transactions](https://typeorm.io/transactions)
- [Database Deadlocks](https://www.postgresql.org/docs/current/explicit-locking.html)
