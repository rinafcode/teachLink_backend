import { Injectable, Logger } from '@nestjs/common';
import { StreamEvent } from '../pipelines/data-pipeline.service';

/**
 * Interface for event store entry
 */
export interface EventStoreEntry<T = any> extends StreamEvent<T> {
  sequenceNumber: number;
  aggregateId: string;
  aggregateType: string;
  version: number;
}

/**
 * Interface for event store snapshot
 */
export interface EventStoreSnapshot<T = any> {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: T;
  timestamp: number;
}

/**
 * Service for implementing event sourcing pattern
 */
@Injectable()
export class EventSourcingService {
  private readonly logger = new Logger(EventSourcingService.name);
  private readonly eventStore: Map<string, EventStoreEntry[]> = new Map();
  private readonly snapshots: Map<string, EventStoreSnapshot> = new Map();
  private sequenceCounter = 0;

  /**
   * Store an event in the event store
   * @param aggregateId The ID of the aggregate
   * @param aggregateType The type of the aggregate
   * @param event The event to store
   * @param version The version of the aggregate
   */
  storeEvent<T>(
    aggregateId: string,
    aggregateType: string,
    event: StreamEvent<T>,
    version: number,
  ): EventStoreEntry<T> {
    const key = `${aggregateType}:${aggregateId}`;
    const entry: EventStoreEntry<T> = {
      ...event,
      sequenceNumber: ++this.sequenceCounter,
      aggregateId,
      aggregateType,
      version,
    };

    if (!this.eventStore.has(key)) {
      this.eventStore.set(key, []);
    }

    this.eventStore.get(key).push(entry);
    this.logger.debug(
      `Event stored: ${event.type} for ${aggregateType}:${aggregateId} (v${version})`,
    );

    return entry;
  }

  /**
   * Get all events for a specific aggregate
   * @param aggregateId The ID of the aggregate
   * @param aggregateType The type of the aggregate
   */
  getEvents<T>(aggregateId: string, aggregateType: string): EventStoreEntry<T>[] {
    const key = `${aggregateType}:${aggregateId}`;
    return (this.eventStore.get(key) || []) as EventStoreEntry<T>[];
  }

  /**
   * Get events for a specific aggregate after a certain version
   * @param aggregateId The ID of the aggregate
   * @param aggregateType The type of the aggregate
   * @param afterVersion The version to start from
   */
  getEventsAfterVersion<T>(
    aggregateId: string,
    aggregateType: string,
    afterVersion: number,
  ): EventStoreEntry<T>[] {
    const events = this.getEvents<T>(aggregateId, aggregateType);
    return events.filter(event => event.version > afterVersion);
  }

  /**
   * Create a snapshot of the current state
   * @param aggregateId The ID of the aggregate
   * @param aggregateType The type of the aggregate
   * @param state The current state
   * @param version The current version
   */
  createSnapshot<T>(
    aggregateId: string,
    aggregateType: string,
    state: T,
    version: number,
  ): EventStoreSnapshot<T> {
    const key = `${aggregateType}:${aggregateId}`;
    const snapshot: EventStoreSnapshot<T> = {
      aggregateId,
      aggregateType,
      version,
      state,
      timestamp: Date.now(),
    };

    this.snapshots.set(key, snapshot);
    this.logger.debug(
      `Snapshot created for ${aggregateType}:${aggregateId} (v${version})`,
    );

    return snapshot;
  }

  /**
   * Get the latest snapshot for an aggregate
   * @param aggregateId The ID of the aggregate
   * @param aggregateType The type of the aggregate
   */
  getLatestSnapshot<T>(
    aggregateId: string,
    aggregateType: string,
  ): EventStoreSnapshot<T> | null {
    const key = `${aggregateType}:${aggregateId}`;
    return (this.snapshots.get(key) as EventStoreSnapshot<T>) || null;
  }

  /**
   * Rebuild an aggregate state from events
   * @param aggregateId The ID of the aggregate
   * @param aggregateType The type of the aggregate
   * @param applyEventFn Function to apply an event to the state
   * @param initialState The initial state
   */
  rebuildAggregate<T>(
    aggregateId: string,
    aggregateType: string,
    applyEventFn: (state: T, event: StreamEvent) => T,
    initialState: T,
  ): { state: T; version: number } {
    // Try to get the latest snapshot first
    const snapshot = this.getLatestSnapshot<T>(aggregateId, aggregateType);
    let state = initialState;
    let version = 0;

    if (snapshot) {
      state = snapshot.state;
      version = snapshot.version;
    }

    // Apply all events after the snapshot version
    const events = this.getEventsAfterVersion<T>(
      aggregateId,
      aggregateType,
      version,
    );

    for (const event of events) {
      state = applyEventFn(state, event);
      version = event.version;
    }

    return { state, version };
  }
}