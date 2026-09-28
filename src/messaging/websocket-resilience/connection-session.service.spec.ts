import { ConnectionSessionService } from './connection-session.service';
import { WS_MAX_PENDING_MESSAGES } from '../../common/utils/websocket.utils';

describe('ConnectionSessionService', () => {
  let service: ConnectionSessionService;

  beforeEach(() => {
    service = new ConnectionSessionService();
  });

  describe('register', () => {
    it('creates a session indexed by both socket and user', () => {
      const session = service.register('user-1', 'socket-1');

      expect(session.userId).toBe('user-1');
      expect(session.socketId).toBe('socket-1');
      expect(session.lastSeq).toBe(0);
      expect(session.pendingOutbound).toEqual([]);
      expect(service.getBySocket('socket-1')).toBe(session);
      expect(service.getByUser('user-1')).toBe(session);
    });

    it('evicts the previous socket mapping when the same user reconnects on a new socket', () => {
      service.register('user-1', 'socket-1');
      const second = service.register('user-1', 'socket-2');

      expect(service.getBySocket('socket-1')).toBeUndefined();
      expect(service.getBySocket('socket-2')).toBe(second);
      expect(service.getByUser('user-1')).toBe(second);
    });
  });

  describe('unregister', () => {
    it('removes and returns the session for a known socket', () => {
      const session = service.register('user-1', 'socket-1');

      const removed = service.unregister('socket-1');

      expect(removed).toBe(session);
      expect(service.getBySocket('socket-1')).toBeUndefined();
      expect(service.getByUser('user-1')).toBeUndefined();
    });

    it('returns undefined for an unknown socket', () => {
      expect(service.unregister('missing-socket')).toBeUndefined();
    });

    it('does not clear the current user->socket mapping when unregistering a stale socket', () => {
      service.register('user-1', 'socket-1');
      service.register('user-1', 'socket-2');

      // socket-1 was already evicted by the reconnect; unregistering it again
      // must not disturb the now-current socket-2 mapping.
      service.unregister('socket-1');

      expect(service.getByUser('user-1')?.socketId).toBe('socket-2');
    });
  });

  describe('getBySocket / getByUser', () => {
    it('returns undefined when nothing is registered', () => {
      expect(service.getBySocket('unknown')).toBeUndefined();
      expect(service.getByUser('unknown')).toBeUndefined();
    });
  });

  describe('recordPong', () => {
    it('updates lastPongAt for a known socket', () => {
      const session = service.register('user-1', 'socket-1');
      const before = session.lastPongAt;

      jest.spyOn(Date, 'now').mockReturnValue(before + 5000);
      service.recordPong('socket-1');

      expect(session.lastPongAt).toBe(before + 5000);
      jest.spyOn(Date, 'now').mockRestore();
    });

    it('does not throw for an unknown socket', () => {
      expect(() => service.recordPong('missing-socket')).not.toThrow();
    });
  });

  describe('enqueueForUser', () => {
    it('enqueues a message with an incrementing sequence number', () => {
      const first = service.enqueueForUser('user-1', 'notify', { a: 1 });
      const second = service.enqueueForUser('user-1', 'notify', { a: 2 });

      expect(first?.seq).toBe(1);
      expect(second?.seq).toBe(2);
      expect(first?.event).toBe('notify');
      expect(first?.payload).toEqual({ a: 1 });
      expect(first?.id).toBe('user-1-1');
    });

    it('appends to the active session pendingOutbound when the user is connected', () => {
      const session = service.register('user-1', 'socket-1');

      const message = service.enqueueForUser('user-1', 'notify', { a: 1 });

      expect(session.pendingOutbound).toEqual([message]);
    });

    it('queues for later when the user has no active session', () => {
      const message = service.enqueueForUser('offline-user', 'notify', { a: 1 });

      expect(message).not.toBeNull();
      expect(service.pendingCount('offline-user')).toBe(1);
    });

    it('drops the message and returns null once the per-user queue is full', () => {
      for (let i = 0; i < WS_MAX_PENDING_MESSAGES; i++) {
        service.enqueueForUser('user-1', 'notify', { i });
      }

      const dropped = service.enqueueForUser('user-1', 'notify', { over: true });

      expect(dropped).toBeNull();
      expect(service.pendingCount('user-1')).toBe(WS_MAX_PENDING_MESSAGES);
    });
  });

  describe('drainPending', () => {
    it('returns only messages after the given sequence and leaves the rest queued', () => {
      service.register('user-1', 'socket-1');
      service.enqueueForUser('user-1', 'notify', { seq: 1 });
      service.enqueueForUser('user-1', 'notify', { seq: 2 });
      service.enqueueForUser('user-1', 'notify', { seq: 3 });

      const drained = service.drainPending('socket-1', 1);

      expect(drained.map((m) => m.seq)).toEqual([2, 3]);
      expect(service.pendingCount('user-1')).toBe(1);
    });

    it('drains everything when no afterSeq is given', () => {
      service.register('user-1', 'socket-1');
      service.enqueueForUser('user-1', 'notify', {});
      service.enqueueForUser('user-1', 'notify', {});

      const drained = service.drainPending('socket-1');

      expect(drained).toHaveLength(2);
      expect(service.pendingCount('user-1')).toBe(0);
    });

    it('returns an empty array for an unknown socket', () => {
      expect(service.drainPending('missing-socket')).toEqual([]);
    });
  });

  describe('pendingCount', () => {
    it('returns 0 for a user with nothing queued', () => {
      expect(service.pendingCount('nobody')).toBe(0);
    });
  });
});
