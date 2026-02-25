import { Injectable, Logger } from '@nestjs/common';

export enum ConflictResolutionStrategy {
  LAST_WRITE_WINS = 'LAST_WRITE_WINS',
  VERSIONING = 'VERSIONING',
  MANUAL_MERGE = 'MANUAL_MERGE',
}

export interface SyncData {
  id: string;
  version: number;
  lastModified: Date;
  data: any;
}

@Injectable()
export class ConflictResolutionService {
  private readonly logger = new Logger(ConflictResolutionService.name);

  /**
   * Resolves conflicts between two sets of data based on a strategy.
   */
  resolve(
    localData: SyncData,
    remoteData: SyncData,
    strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.LAST_WRITE_WINS,
  ): SyncData {
    this.logger.log(`Resolving conflict for ${localData.id} using ${strategy}`);

    switch (strategy) {
      case ConflictResolutionStrategy.LAST_WRITE_WINS:
        return this.lastWriteWins(localData, remoteData);
      case ConflictResolutionStrategy.VERSIONING:
        return this.versioning(localData, remoteData);
      case ConflictResolutionStrategy.MANUAL_MERGE:
        return this.manualMerge(localData, remoteData);
      default:
        this.logger.warn(`Unknown strategy ${strategy}, defaulting to LAST_WRITE_WINS`);
        return this.lastWriteWins(localData, remoteData);
    }
  }

  private lastWriteWins(local: SyncData, remote: SyncData): SyncData {
    return local.lastModified >= remote.lastModified ? local : remote;
  }

  private versioning(local: SyncData, remote: SyncData): SyncData {
    return local.version >= remote.version ? local : remote;
  }

  private manualMerge(local: SyncData, remote: SyncData): SyncData {
    // In a real scenario, this would trigger a notification or 
    // flag the record for human intervention.
    // For now, we'll mark it as "needs_merge" in the data.
    return {
      ...local,
      data: {
        ...local.data,
        _conflict: {
          remote: remote.data,
          status: 'needs_merge',
        },
      },
    };
  }
}
