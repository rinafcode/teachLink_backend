import { Test, TestingModule } from '@nestjs/testing';
import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PresenceService],
    }).compile();
    service = module.get(PresenceService);
  });

  describe('join', () => {
    it('returns presence info', () => {
      const info = service.join('s1', 'u1');
      expect(info.userId).toBe('u1');
      expect(info.sessionId).toBe('s1');
      expect(info.joinedAt).toBeInstanceOf(Date);
    });

    it('marks user as present', () => {
      service.join('s1', 'u1');
      expect(service.isPresent('s1', 'u1')).toBe(true);
    });
  });

  describe('leave', () => {
    it('removes user from session', () => {
      service.join('s1', 'u1');
      service.leave('s1', 'u1');
      expect(service.isPresent('s1', 'u1')).toBe(false);
    });

    it('cleans up empty session', () => {
      service.join('s1', 'u1');
      service.leave('s1', 'u1');
      expect(service.getPresence('s1')).toHaveLength(0);
    });
  });

  describe('updateCursor', () => {
    it('updates cursor position', () => {
      service.join('s1', 'u1');
      service.updateCursor('s1', 'u1', 42);
      const presence = service.getPresence('s1');
      expect(presence[0].cursorPosition).toBe(42);
    });

    it('is a no-op for unknown user', () => {
      expect(() => service.updateCursor('s1', 'unknown', 5)).not.toThrow();
    });
  });

  describe('getPresence', () => {
    it('returns all users in session', () => {
      service.join('s1', 'u1');
      service.join('s1', 'u2');
      expect(service.getPresence('s1')).toHaveLength(2);
    });

    it('returns empty array for unknown session', () => {
      expect(service.getPresence('unknown')).toEqual([]);
    });
  });
});
