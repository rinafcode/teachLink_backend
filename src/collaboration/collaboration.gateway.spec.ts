import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationGateway } from './collaboration.gateway';
import { OtCrdtService, Operation } from './ot-crdt.service';
import { PresenceService } from './presence.service';
import { ChangeHistoryService } from './change-history.service';
import { WsPayloadSizeGuardService } from './guards/ws-payload-size-guard.service';
import { RedisSocketRegistryService } from './redis-socket-registry.service';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth.guard';
import { COLLABORATION_EVENTS } from './constants/collaboration-events.constants';

const createMockSocket = (id = 'sock-1') => ({
  id,
  join: jest.fn().mockResolvedValue(undefined),
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  data: {},
  handshake: { auth: {}, query: {} },
});

const createMockServer = () => ({
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
});

describe('CollaborationGateway', () => {
  let gateway: CollaborationGateway;
  let socketRegistry: jest.Mocked<RedisSocketRegistryService>;
  let presence: jest.Mocked<PresenceService>;
  let otCrdt: jest.Mocked<OtCrdtService>;
  let history: jest.Mocked<ChangeHistoryService>;
  let payloadGuard: jest.Mocked<WsPayloadSizeGuardService>;
  let server: ReturnType<typeof createMockServer>;

  beforeEach(async () => {
    socketRegistry = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      remove: jest.fn().mockResolvedValue(undefined),
      setGraceDisconnect: jest.fn().mockResolvedValue(undefined),
    } as any;

    presence = {
      join: jest.fn().mockResolvedValue({
        userId: 'u1',
        sessionId: 's1',
        joinedAt: new Date(),
        lastSeenAt: new Date(),
      }),
      leave: jest.fn().mockResolvedValue(undefined),
      getPresence: jest.fn().mockResolvedValue([]),
      isPresent: jest.fn().mockResolvedValue(false),
      updateCursor: jest.fn().mockResolvedValue(undefined),
    } as any;

    otCrdt = {
      nextRevision: jest.fn().mockReturnValue(1),
      currentRevision: jest.fn().mockReturnValue(0),
      transform: jest.fn().mockImplementation((op) => ({ operation: op, transformed: false })),
      resolveConflict: jest.fn().mockImplementation((op1) => op1),
    } as any;

    history = {
      record: jest.fn(),
      getHistory: jest.fn().mockReturnValue([]),
      getLatest: jest.fn().mockReturnValue([]),
      clear: jest.fn(),
    } as any;

    payloadGuard = {
      validate: jest.fn(),
      getMaxPayloadBytes: jest.fn().mockReturnValue(65536),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationGateway,
        { provide: OtCrdtService, useValue: otCrdt },
        { provide: PresenceService, useValue: presence },
        { provide: ChangeHistoryService, useValue: history },
        { provide: WsPayloadSizeGuardService, useValue: payloadGuard },
        { provide: RedisSocketRegistryService, useValue: socketRegistry },
      ],
    })
      .overrideGuard(WsJwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    gateway = module.get(CollaborationGateway);
    server = createMockServer();
    gateway.server = server as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('logs client connection', async () => {
      const client = createMockSocket();
      await gateway.handleConnection(client as any);
    });
  });

  describe('handleJoin', () => {
    it('stores socket mapping in Redis', async () => {
      const client = createMockSocket('sock-1');

      await gateway.handleJoin(
        { sessionId: 's1', userId: 'u1', resourceType: 'document' as any },
        client as any,
      );

      expect(client.join).toHaveBeenCalledWith('s1');
      expect(socketRegistry.set).toHaveBeenCalledWith('sock-1', {
        sessionId: 's1',
        userId: 'u1',
      });
    });

    it('registers user in Redis-backed presence', async () => {
      const client = createMockSocket();

      await gateway.handleJoin(
        { sessionId: 's1', userId: 'u1', resourceType: 'document' as any },
        client as any,
      );

      expect(presence.join).toHaveBeenCalledWith('s1', 'u1');
    });

    it('broadcasts user-joined to session via adapter', async () => {
      presence.getPresence.mockResolvedValue([
        { userId: 'u1', sessionId: 's1', joinedAt: new Date(), lastSeenAt: new Date() },
      ]);
      const client = createMockSocket();

      await gateway.handleJoin(
        { sessionId: 's1', userId: 'u1', resourceType: 'document' as any },
        client as any,
      );

      expect(server.to).toHaveBeenCalledWith('s1');
      expect(server.emit).toHaveBeenCalledWith(COLLABORATION_EVENTS.USER_JOINED, {
        userId: 'u1',
        event: 'joined',
        presence: expect.any(Array),
      });
    });

    it('returns session state with presence from Redis', async () => {
      presence.getPresence.mockResolvedValue([
        { userId: 'u1', sessionId: 's1', joinedAt: new Date(), lastSeenAt: new Date() },
      ]);
      const client = createMockSocket();

      const result = await gateway.handleJoin(
        { sessionId: 's1', userId: 'u1', resourceType: 'document' as any },
        client as any,
      );

      expect(result.event).toBe(COLLABORATION_EVENTS.SESSION_STATE);
      expect(result.data.sessionId).toBe('s1');
      expect(result.data.presence).toHaveLength(1);
    });
  });

  describe('handleDisconnect', () => {
    it('cleans up Redis socket mapping with grace period', async () => {
      socketRegistry.get.mockResolvedValue({ sessionId: 's1', userId: 'u1' });
      presence.getPresence.mockResolvedValue([]);
      const client = createMockSocket('sock-1');

      await gateway.handleDisconnect(client as any);

      expect(socketRegistry.get).toHaveBeenCalledWith('sock-1');
      expect(presence.leave).toHaveBeenCalledWith('s1', 'u1');
      expect(socketRegistry.setGraceDisconnect).toHaveBeenCalledWith('sock-1', {
        sessionId: 's1',
        userId: 'u1',
      });
    });

    it('emits user-left event to session', async () => {
      socketRegistry.get.mockResolvedValue({ sessionId: 's1', userId: 'u1' });
      presence.getPresence.mockResolvedValue([]);
      const client = createMockSocket('sock-1');

      await gateway.handleDisconnect(client as any);

      expect(server.to).toHaveBeenCalledWith('s1');
      expect(server.emit).toHaveBeenCalledWith(COLLABORATION_EVENTS.USER_JOINED, {
        userId: 'u1',
        event: 'left',
        presence: [],
      });
    });

    it('does nothing when socket has no mapping', async () => {
      socketRegistry.get.mockResolvedValue(null);
      const client = createMockSocket('sock-unknown');

      await gateway.handleDisconnect(client as any);

      expect(presence.leave).not.toHaveBeenCalled();
      expect(server.emit).not.toHaveBeenCalled();
    });
  });

  describe('reconnect restores membership', () => {
    it('new join creates fresh mapping for reconnecting user', async () => {
      presence.getPresence.mockResolvedValue([
        { userId: 'u1', sessionId: 's1', joinedAt: new Date(), lastSeenAt: new Date() },
      ]);
      const client = createMockSocket('sock-new');

      const result = await gateway.handleJoin(
        { sessionId: 's1', userId: 'u1', resourceType: 'document' as any },
        client as any,
      );

      expect(socketRegistry.set).toHaveBeenCalledWith('sock-new', {
        sessionId: 's1',
        userId: 'u1',
      });
      expect(result.event).toBe(COLLABORATION_EVENTS.SESSION_STATE);
    });

    it('old socket mapping gets grace TTL on disconnect', async () => {
      socketRegistry.get.mockResolvedValue({ sessionId: 's1', userId: 'u1' });
      presence.getPresence.mockResolvedValue([]);
      const oldClient = createMockSocket('sock-old');

      await gateway.handleDisconnect(oldClient as any);

      expect(socketRegistry.setGraceDisconnect).toHaveBeenCalledWith('sock-old', {
        sessionId: 's1',
        userId: 'u1',
      });
    });
  });

  describe('cross-pod broadcast', () => {
    it('operations broadcast via Redis adapter to session room', async () => {
      const client = createMockSocket('sock-1');

      gateway.handleOperation(
        {
          sessionId: 's1',
          userId: 'u1',
          resourceType: 'document' as any,
          operation: { type: 'insert', position: 0, content: 'a' },
        },
        client as any,
      );

      expect(client.to).toHaveBeenCalledWith('s1');
    });

    it('conflict resolution broadcasts via Redis adapter', async () => {
      const body = {
        op1: {
          type: 'insert' as const,
          position: 0,
          content: 'a',
          userId: 'u1',
          sessionId: 's1',
          revision: 1,
        },
        op2: {
          type: 'insert' as const,
          position: 0,
          content: 'b',
          userId: 'u2',
          sessionId: 's1',
          revision: 1,
        },
        sessionId: 's1',
      };

      const result = gateway.handleConflict(body);

      expect(server.to).toHaveBeenCalledWith('s1');
      expect(server.emit).toHaveBeenCalledWith(
        COLLABORATION_EVENTS.CONFLICT_RESOLVED,
        expect.any(Object),
      );
      expect(result.event).toBe(COLLABORATION_EVENTS.CONFLICT_RESOLVED);
    });
  });

  describe('handleOperation', () => {
    it('transforms and records operation', () => {
      const client = createMockSocket('sock-1');

      const result = gateway.handleOperation(
        {
          sessionId: 's1',
          userId: 'u1',
          resourceType: 'document' as any,
          operation: { type: 'insert', position: 0, content: 'a' },
        },
        client as any,
      );

      expect(otCrdt.nextRevision).toHaveBeenCalledWith('s1');
      expect(history.record).toHaveBeenCalled();
      expect(result.event).toBe(COLLABORATION_EVENTS.OPERATION_APPLIED);
    });
  });

  describe('handleSync', () => {
    it('returns full sync data', () => {
      const result = gateway.handleSync({ sessionId: 's1', userId: 'u1' });

      expect(result.event).toBe(COLLABORATION_EVENTS.FULL_SYNC);
      expect(result.data.sessionId).toBe('s1');
    });
  });
});
