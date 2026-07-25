import { Injectable } from '@nestjs/common';
import { Operation } from './ot-crdt.service';

export interface HistoryEntry {
  revision: number;
  operation: Operation;
  appliedAt: Date;
}

@Injectable()
export class ChangeHistoryService {
  // sessionId -> ordered history entries
  private readonly history = new Map<string, HistoryEntry[]>();

  record(operation: Operation): void {
    if (!this.history.has(operation.sessionId)) {
      this.history.set(operation.sessionId, []);
    }
    this.history.get(operation.sessionId)!.push({
      revision: operation.revision,
      operation,
      appliedAt: new Date(),
    });
  }

  getHistory(sessionId: string, fromRevision = 0): HistoryEntry[] {
    return (this.history.get(sessionId) ?? []).filter((e) => e.revision > fromRevision);
  }

  getLatest(sessionId: string, limit = 50): HistoryEntry[] {
    const entries = this.history.get(sessionId) ?? [];
    return entries.slice(-limit);
  }

  clear(sessionId: string): void {
    this.history.delete(sessionId);
  }
}
