# Advanced Database Migration System

This module provides a comprehensive database migration system with the following features:

## Features

- **Version Control**: Track all database schema changes with versioning
- **Rollback Capabilities**: Safely revert migrations with data preservation
- **Environment Management**: Synchronize migrations across different environments
- **Schema Validation**: Ensure integrity and prevent breaking changes
- **Conflict Resolution**: Handle concurrent migrations and resolve conflicts

## Architecture

The system consists of several core components:

### Core Services

1. **MigrationService**: Main orchestrator for running and tracking migrations
2. **RollbackService**: Handles migration reversals and recovery
3. **SchemaValidationService**: Ensures schema integrity before and after migrations
4. **EnvironmentSyncService**: Manages multi-environment synchronization
5. **ConflictResolutionService**: Detects and resolves migration conflicts
6. **MigrationRunnerService**: Bootstraps migration execution

### Data Model

The system tracks migrations in a dedicated `migrations` table with the following fields:
- `id`: Unique identifier (UUID)
- `name`: Migration name
- `version`: Migration version
- `status`: Current status (pending, completed, failed, rolled_back)
- `appliedAt`: Timestamp when applied
- `rolledBackAt`: Timestamp when rolled back
- `createdAt`/`updatedAt`: Standard timestamps
- `errorMessage`: Error details if migration failed

## Usage

### Running Migrations

Run all pending migrations:
```bash
curl -X POST http://localhost:3000/migrations/run
```

### Checking Migration Status

View all migrations and their status:
```bash
curl GET http://localhost:3000/migrations
```

### Rolling Back Migrations

Roll back the last migration:
```bash
curl -X POST http://localhost:3000/migrations/rollback
```

Roll back multiple migrations:
```bash
curl -X POST http://localhost:3000/migrations/rollback/3
```

### Reset All Migrations

Completely reset all migrations (development only):
```bash
curl -X DELETE http://localhost:3000/migrations/reset
```

### Conflict History

Check migration conflicts:
```bash
curl GET http://localhost:3000/migrations/conflicts
```

## Creating New Migrations

To create a new migration:

1. Create a new file in the `samples` directory following the migration interface
2. Implement the `up` and `down` methods
3. Register the migration in your migration configuration

Example migration:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { MigrationConfig } from '../migration.service';

@Injectable()
export class SampleUserTableMigration implements MigrationConfig {
  name = 'sample-user-table';
  version = '1.0.0';
  dependencies = []; // List any dependencies this migration has

  private readonly logger = new Logger(SampleUserTableMigration.name);

  async up(connection: any): Promise<void> {
    // Apply schema changes
  }

  async down(connection: any): Promise<void> {
    // Revert schema changes
  }
}
```

## Configuration

Enable automatic migration execution on startup by setting:
```bash
AUTO_RUN_MIGRATIONS=true
```

## Best Practices

1. Always test migrations in a development environment first
2. Write reversible migrations (ensure `down` undoes `up`)
3. Validate schema changes before applying
4. Handle dependencies between migrations
5. Monitor migration execution and logs
6. Create backups before running critical migrations

## Error Handling

The system provides comprehensive error handling:
- Automatic rollback on migration failure
- Detailed error logging
- Conflict detection and resolution
- Environment-specific error handling

## Security Considerations

- Migrations should be run by authorized personnel only
- Access to migration endpoints should be restricted in production
- Review all migration scripts before execution
- Implement proper database permissions