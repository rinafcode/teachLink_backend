import { Injectable, Logger } from '@nestjs/common';
import { Migration } from '../entities/migration.entity';

@Injectable()
export class ConflictResolutionService {
  private readonly logger = new Logger(ConflictResolutionService.name);

  async checkForConflicts(migrations: Migration[]): Promise<void> {
    this.logger.log('Checking for migration conflicts');

    // Logic to detect migration conflicts
    const conflictMap = new Map<string, number>();

    migrations.forEach(migration => {
      const envVersion = `${migration.environment}_${migration.version}`;
      conflictMap.set(envVersion, (conflictMap.get(envVersion) || 0) + 1);
    });

    // Detect any versions with more than one occurrence
    for (const [envVersion, count] of conflictMap.entries()) {
      if (count > 1) {
        this.logger.error(`Conflict detected for version ${envVersion}`);
        throw new Error(`Conflict detected for version ${envVersion}`);
      }
    }

    this.logger.log('No migration conflicts found');
  }

  async resolveConflicts(migrations: Migration[]): Promise<Migration[]> {
    this.logger.log('Resolving migration conflicts');

    // Simplified logic to resolve conflicts by choosing the latest migration
    const resolvedMigrations = migrations.reduce((acc: Migration[], curr: Migration) => {
      const existing = acc.find(m => m.version === curr.version && m.environment === curr.environment);
      if (!existing || existing.timestamp < curr.timestamp) {
        acc = acc.filter(m => m.version !== curr.version || m.environment !== curr.environment);
        acc.push(curr);
      }
      return acc;
    }, []);

    this.logger.log(`Resolved conflicts, remaining migrations: ${resolvedMigrations.length}`);
    return resolvedMigrations;
  }

  async suggestConflictResolutionStrategies(): Promise<string[]> {
    const strategies = [
      'Manual review for concurrent modifications.',
      'Use schema snapshots to determine valid state.',
      'Apply conflict resolution through custom scripts.'
    ];

    this.logger.log('Suggesting conflict resolution strategies');
    return strategies;
  }
}
