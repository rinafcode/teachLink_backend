import { Test, TestingModule } from '@nestjs/testing';
import { EventSourcingService, EventStoreEntry, EventStoreSnapshot } from './event-sourcing.service';

describe('EventSourcingService', () => {
  let service: EventSourcingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventSourcingService],
    }).compile();

    service = module.get<EventSourcingService>(EventSourcingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('storeEvent', () => {
    it('should store an event and return the event ID', () => {
      // Create test event
      const event = {
        aggregateId: 'user-123',
        aggregateType: 'user',
        eventType: 'UserCreated',
        data: { name: 'John Doe', email: 'john@example.com' },
        metadata: { userId: 'admin-1' },
        version: 1,
      };

      const eventId = service.storeEvent(event);
      expect(eventId).toBeDefined();
      expect(typeof eventId).toBe('string');
    });
  });

  describe('getEvents', () => {
    it('should retrieve events for a specific aggregate', () => {
      // Store test events
      const aggregateId = 'user-123';
      const aggregateType = 'user';
      
      service.storeEvent({
        aggregateId,
        aggregateType,
        eventType: 'UserCreated',
        data: { name: 'John Doe', email: 'john@example.com' },
        metadata: { userId: 'admin-1' },
        version: 1,
      });
      
      service.storeEvent({
        aggregateId,
        aggregateType,
        eventType: 'UserUpdated',
        data: { name: 'John Updated' },
        metadata: { userId: 'admin-1' },
        version: 2,
      });

      // Store an event for a different aggregate
      service.storeEvent({
        aggregateId: 'user-456',
        aggregateType,
        eventType: 'UserCreated',
        data: { name: 'Jane Doe' },
        metadata: { userId: 'admin-1' },
        version: 1,
      });

      // Retrieve events for the specific aggregate
      const events = service.getEvents(aggregateId, aggregateType);
      
      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe('UserCreated');
      expect(events[1].eventType).toBe('UserUpdated');
    });

    it('should return events filtered by version if specified', () => {
      // Store test events with different versions
      const aggregateId = 'user-123';
      const aggregateType = 'user';
      
      service.storeEvent({
        aggregateId,
        aggregateType,
        eventType: 'UserCreated',
        data: { name: 'John Doe' },
        metadata: { userId: 'admin-1' },
        version: 1,
      });
      
      service.storeEvent({
        aggregateId,
        aggregateType,
        eventType: 'UserUpdated',
        data: { name: 'John Updated' },
        metadata: { userId: 'admin-1' },
        version: 2,
      });
      
      service.storeEvent({
        aggregateId,
        aggregateType,
        eventType: 'UserEmailChanged',
        data: { email: 'john.updated@example.com' },
        metadata: { userId: 'admin-1' },
        version: 3,
      });

      // Retrieve events with version > 1
      const events = service.getEvents(aggregateId, aggregateType, 1);
      
      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe('UserUpdated');
      expect(events[1].eventType).toBe('UserEmailChanged');
    });
  });

  describe('createSnapshot', () => {
    it('should create a snapshot for an aggregate', () => {
      // Store test events
      const aggregateId = 'user-123';
      const aggregateType = 'user';
      
      service.storeEvent({
        aggregateId,
        aggregateType,
        eventType: 'UserCreated',
        data: { name: 'John Doe', email: 'john@example.com' },
        metadata: { userId: 'admin-1' },
        version: 1,
      });
      
      service.storeEvent({
        aggregateId,
        aggregateType,
        eventType: 'UserUpdated',
        data: { name: 'John Updated' },
        metadata: { userId: 'admin-1' },
        version: 2,
      });

      // Create snapshot
      const state = { name: 'John Updated', email: 'john@example.com' };
      const snapshotId = service.createSnapshot({
        aggregateId,
        aggregateType,
        version: 2,
        state,
        timestamp: Date.now(),
      });

      expect(snapshotId).toBeDefined();
      expect(typeof snapshotId).toBe('string');
    });
  });

  describe('getLatestSnapshot', () => {
    it('should retrieve the latest snapshot for an aggregate', () => {
      // Store test events and create snapshots
      const aggregateId = 'user-123';
      const aggregateType = 'user';
      
      // Create first snapshot at version 1
      service.createSnapshot({
        aggregateId,
        aggregateType,
        version: 1,
        state: { name: 'John Doe', email: 'john@example.com' },
        timestamp: Date.now() - 1000, // Older timestamp
      });
      
      // Create second snapshot at version 2
      service.createSnapshot({
        aggregateId,
        aggregateType,
        version: 2,
        state: { name: 'John Updated', email: 'john@example.com' },
        timestamp: Date.now(), // Newer timestamp
      });

      // Retrieve latest snapshot
      const snapshot = service.getLatestSnapshot(aggregateId, aggregateType);
      
      expect(snapshot).toBeDefined();
      expect(snapshot.version).toBe(2);
      expect(snapshot.state.name).toBe('John Updated');
    });

    it('should return null if no snapshot exists', () => {
      const snapshot = service.getLatestSnapshot('non-existent', 'user');
      expect(snapshot).toBeNull();
    });
  });

  describe('rebuildAggregateState', () => {
    it('should rebuild aggregate state from events', () => {
      // Store test events
      const aggregateId = 'user-123';
      const aggregateType = 'user';
      
      service.storeEvent({
        aggregateId,
        aggregateType,
        eventType: 'UserCreated',
        data: { name: 'John Doe', email: 'john@example.com' },
        metadata: { userId: 'admin-1' },
        version: 1,
      });
      
      service.storeEvent({
        aggregateId,
        aggregateType,
        eventType: 'UserUpdated',
        data: { name: 'John Updated' },
        metadata: { userId: 'admin-1' },
        version: 2,
      });
      
      service.storeEvent({
        aggregateId,
        aggregateType,
        eventType: 'UserEmailChanged',
        data: { email: 'john.updated@example.com' },
        metadata: { userId: 'admin-1' },
        version: 3,
      });

      // Define event handlers for rebuilding state
      const eventHandlers = {
        UserCreated: (state, event) => ({ ...state, ...event.data }),
        UserUpdated: (state, event) => ({ ...state, ...event.data }),
        UserEmailChanged: (state, event) => ({ ...state, ...event.data }),
      };

      // Rebuild state
      const state = service.rebuildAggregateState(aggregateId, aggregateType, {}, eventHandlers);
      
      expect(state).toEqual({
        name: 'John Updated',
        email: 'john.updated@example.com',
      });
    });

    it('should rebuild state from a snapshot and subsequent events', () => {
      // Store test events
      const aggregateId = 'user-123';
      const aggregateType = 'user';
      
      service.storeEvent({
        aggregateId,
        aggregateType,
        eventType: 'UserCreated',
        data: { name: 'John Doe', email: 'john@example.com' },
        metadata: { userId: 'admin-1' },
        version: 1,
      });
      
      // Create snapshot at version 1
      service.createSnapshot({
        aggregateId,
        aggregateType,
        version: 1,
        state: { name: 'John Doe', email: 'john@example.com' },
        timestamp: Date.now(),
      });
      
      // Add events after the snapshot
      service.storeEvent({
        aggregateId,
        aggregateType,
        eventType: 'UserUpdated',
        data: { name: 'John Updated' },
        metadata: { userId: 'admin-1' },
        version: 2,
      });
      
      service.storeEvent({
        aggregateId,
        aggregateType,
        eventType: 'UserEmailChanged',
        data: { email: 'john.updated@example.com' },
        metadata: { userId: 'admin-1' },
        version: 3,
      });

      // Define event handlers for rebuilding state
      const eventHandlers = {
        UserCreated: (state, event) => ({ ...state, ...event.data }),
        UserUpdated: (state, event) => ({ ...state, ...event.data }),
        UserEmailChanged: (state, event) => ({ ...state, ...event.data }),
      };

      // Rebuild state using snapshot
      const state = service.rebuildAggregateState(aggregateId, aggregateType, {}, eventHandlers, true);
      
      expect(state).toEqual({
        name: 'John Updated',
        email: 'john.updated@example.com',
      });
    });
  });
});