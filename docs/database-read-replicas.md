# Database Read Replicas

TeachLink can route read-heavy traffic to PostgreSQL read replicas while keeping writes and read-after-write paths on the primary database.

## Environment Variables

Primary database settings continue to use the existing variables:

```env
DATABASE_HOST=primary.db.internal
DATABASE_PORT=5432
DATABASE_USER=teachlink
DATABASE_PASSWORD=change-me
DATABASE_NAME=teachlink
```

Configure replicas with either connection URLs:

```env
DATABASE_REPLICA_URLS=postgres://teachlink_ro:secret@replica-1.db.internal:5432/teachlink,postgres://teachlink_ro:secret@replica-2.db.internal:5432/teachlink
```

Or with host lists that reuse the primary user, password, and database by default:

```env
DATABASE_REPLICA_HOSTS=replica-1.db.internal,replica-2.db.internal
DATABASE_REPLICA_PORTS=5432,5432
DATABASE_REPLICA_USER=teachlink_ro
DATABASE_REPLICA_PASSWORD=secret
DATABASE_REPLICA_NAME=teachlink
```

When no replica variables are present, the app keeps its single-primary TypeORM connection.

## Routing Behavior

`getDatabaseConfig()` enables TypeORM replication when at least one replica is configured:

- Writes go to the primary database.
- Normal TypeORM read queries can use replica connections.
- Explicit consistent reads can use `ReadReplicaRoutingService.consistentRead()` to force the primary.

Use eventual reads for dashboards, lists, and analytics where replica lag is acceptable:

```ts
await readReplicaRoutingService.read((manager) => manager.getRepository(Course).find({ take: 20 }));
```

Use consistent reads immediately after writes, during authorization decisions, and inside workflows that must observe the latest committed data:

```ts
await readReplicaRoutingService.consistentRead((manager) =>
  manager.getRepository(Course).findOneByOrFail({ id: courseId }),
);
```

## Failover Strategy

`ReadReplicaRoutingService.read()` retries replica read failures on the primary by default. This keeps user-facing read paths available if one replica is unavailable.

For strict replica-only behavior, disable primary failover:

```ts
await readReplicaRoutingService.read(operation, { failoverToPrimary: false });
```

Operational recommendations:

- Use managed PostgreSQL replication with health checks and automatic replica replacement.
- Alert on replica lag and remove lagging replicas from `DATABASE_REPLICA_URLS`.
- Keep primary pool capacity for writes and failover reads.
- Prefer `consistentRead()` for post-write flows until replica lag is below the business tolerance.
