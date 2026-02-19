import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface ChangeRecord {
  id: string;
  sessionId: string;
  userId: string;
  change: any;
  operationType: string;
  timestamp: number;
  previousValue?: any;
  newValue?: any;
  versionNumber: number;
}

export interface VersionHistory {
  sessionId: string;
  versions: ChangeRecord[];
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class VersionControlService {
  private readonly logger = Logger;
  private histories: Map<string, VersionHistory> = new Map();

  /**
   * Record a change in the version history
   */
  async recordChange(sessionId: string, userId: string, change: any): Promise<ChangeRecord> {
    let history = this.histories.get(sessionId);
    
    if (!history) {
      history = {
        sessionId,
        versions: [],
        currentVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.histories.set(sessionId, history);
    }

    const versionNumber = history.currentVersion + 1;
    const changeRecord: ChangeRecord = {
      id: uuidv4(),
      sessionId,
      userId,
      change,
      operationType: this.getOperationType(change),
      timestamp: Date.now(),
      previousValue: this.getPreviousValue(history, change),
      newValue: this.getNewValue(change),
      versionNumber,
    };

    history.versions.push(changeRecord);
    history.currentVersion = versionNumber;
    history.updatedAt = new Date();

    this.logger.log(`Recorded change ${changeRecord.id} for session ${sessionId}, version ${versionNumber}`);

    return changeRecord;
  }

  /**
   * Get the version history for a session
   */
  async getVersionHistory(sessionId: string): Promise<ChangeRecord[]> {
    const history = this.histories.get(sessionId);
    if (!history) {
      return [];
    }

    return [...history.versions];
  }

  /**
   * Get a specific version of a session
   */
  async getVersion(sessionId: string, versionNumber: number): Promise<ChangeRecord | null> {
    const history = this.histories.get(sessionId);
    if (!history) {
      return null;
    }

    const version = history.versions.find(v => v.versionNumber === versionNumber);
    return version || null;
  }

  /**
   * Get the current version of a session
   */
  async getCurrentVersion(sessionId: string): Promise<ChangeRecord | null> {
    const history = this.histories.get(sessionId);
    if (!history) {
      return null;
    }

    if (history.versions.length === 0) {
      return null;
    }

    return history.versions[history.versions.length - 1];
  }

  /**
   * Revert to a specific version
   */
  async revertToVersion(sessionId: string, versionNumber: number): Promise<ChangeRecord[]> {
    const history = this.histories.get(sessionId);
    if (!history) {
      throw new Error(`No history found for session ${sessionId}`);
    }

    const versionIndex = history.versions.findIndex(v => v.versionNumber === versionNumber);
    if (versionIndex === -1) {
      throw new Error(`Version ${versionNumber} not found for session ${sessionId}`);
    }

    // Keep only versions up to the specified version
    history.versions = history.versions.slice(0, versionIndex + 1);
    history.currentVersion = versionNumber;
    history.updatedAt = new Date();

    this.logger.log(`Reverted session ${sessionId} to version ${versionNumber}`);

    return [...history.versions];
  }

  /**
   * Compare two versions
   */
  async compareVersions(sessionId: string, version1: number, version2: number): Promise<{
    differences: any;
    version1Data: ChangeRecord | null;
    version2Data: ChangeRecord | null;
  }> {
    const v1 = await this.getVersion(sessionId, version1);
    const v2 = await this.getVersion(sessionId, version2);

    const differences = this.calculateDifferences(v1?.change, v2?.change);

    return {
      differences,
      version1Data: v1,
      version2Data: v2,
    };
  }

  /**
   * Get change statistics
   */
  async getChangeStatistics(sessionId: string): Promise<{
    totalChanges: number;
    changesByUser: Map<string, number>;
    changesOverTime: { date: Date; count: number }[];
  }> {
    const history = this.histories.get(sessionId);
    if (!history) {
      return {
        totalChanges: 0,
        changesByUser: new Map(),
        changesOverTime: [],
      };
    }

    const changesByUser = new Map<string, number>();
    const changesOverTime: { date: Date; count: number }[] = [];

    for (const version of history.versions) {
      // Count changes by user
      const userCount = changesByUser.get(version.userId) || 0;
      changesByUser.set(version.userId, userCount + 1);

      // Group by day for time series
      const dateStr = new Date(version.timestamp).toDateString();
      const timeEntry = changesOverTime.find(entry => 
        entry.date.toDateString() === new Date(version.timestamp).toDateString()
      );
      
      if (timeEntry) {
        timeEntry.count++;
      } else {
        changesOverTime.push({
          date: new Date(version.timestamp),
          count: 1,
        });
      }
    }

    return {
      totalChanges: history.versions.length,
      changesByUser,
      changesOverTime,
    };
  }

  /**
   * Get the operation type from a change object
   */
  private getOperationType(change: any): string {
    if (change.type) {
      return change.type;
    }
    if (change.operation) {
      return change.operation;
    }
    return 'unknown';
  }

  /**
   * Extract the previous value from history
   */
  private getPreviousValue(history: VersionHistory, change: any): any {
    // In a real implementation, this would retrieve the previous state
    // For now, we'll return the last recorded value if available
    if (history.versions.length > 0) {
      return history.versions[history.versions.length - 1].newValue;
    }
    return undefined;
  }

  /**
   * Extract the new value from a change
   */
  private getNewValue(change: any): any {
    if (change.newValue !== undefined) {
      return change.newValue;
    }
    if (change.data !== undefined) {
      return change.data;
    }
    return change;
  }

  /**
   * Calculate differences between two states
   */
  private calculateDifferences(state1: any, state2: any): any {
    // This is a simplified difference calculation
    // A production implementation would use a more sophisticated diff algorithm
    return {
      state1,
      state2,
      hasChanges: JSON.stringify(state1) !== JSON.stringify(state2),
    };
  }
}