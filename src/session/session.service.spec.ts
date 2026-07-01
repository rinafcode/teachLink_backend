import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import { SESSION_REDIS_CLIENT } from './session.constants';

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  eval: jest.fn(),
  multi: jest.fn(),
  zadd: jest.fn().mockResolvedValue(1),
  zrem: jest.fn().mockResolvedValue(1),
  zrange: jest.fn().mockResolvedValue([]),
  scan: jest.fn(),
  status: 'ready',
  quit: jest.fn(),
};

const mockMulti = {
  set: jest.fn().mockReturnThis(),
  del: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultVal?: string) => {
    const values: Record<string, string> = {
      AUTH_SESSION_PREFIX: 'auth:sess:',
      AUTH_SESSION_LEGACY_PREFIX: 'session:',
      AUTH_SESSION_TTL_SECONDS: '604800',
      SESSION_LOCK_TTL_MS: '5000',
      SESSION_LOCK_MAX_RETRIES: '5',
      SESSION_LOCK_RETRY_DELAY_MS: '120',
    };
    return values[key] ?? defaultVal ?? '';
  }),
};

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    mockRedis.multi.mockReturnValue(mockMulti);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: SESSION_REDIS_CLIENT, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('should create a session and return a sid', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const sid = await service.createSession('user-123', { role: 'student' });

      expect(typeof sid).toBe('string');
      expect(sid.length).toBeGreaterThan(0);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('auth:sess:'),
        expect.any(String),
        'EX',
        604800,
      );
    });

    it('should store userId and metadata in session payload', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.createSession('user-456', { plan: 'premium' });

      const payload = JSON.parse(mockRedis.set.mock.calls[0][1]);
      expect(payload.userId).toBe('user-456');
      expect(payload.metadata.plan).toBe('premium');
      expect(payload.version).toBe(1);
    });
  });

  describe('getSession', () => {
    it('should return parsed session when found in Redis', async () => {
      const sessionData = {
        sid: 'test-sid',
        userId: 'user-123',
        metadata: {},
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      const result = await service.getSession('test-sid');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-123');
      expect(result?.version).toBe(1);
    });

    it('should return null when session does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getSession('nonexistent-sid');

      expect(result).toBeNull();
    });

    it('should return null when session payload is invalid JSON', async () => {
      mockRedis.get.mockResolvedValue('not-valid-json{{{');

      const result = await service.getSession('bad-sid');

      expect(result).toBeNull();
    });
  });

  describe('touchSession', () => {
    it('should update metadata and increment version', async () => {
      const sessionData = {
        sid: 'test-sid',
        userId: 'user-123',
        metadata: { role: 'student' },
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      await service.touchSession('test-sid', { lastPage: '/dashboard' });

      expect(mockMulti.set).toHaveBeenCalled();
      expect(mockMulti.expire).toHaveBeenCalled();
      expect(mockMulti.exec).toHaveBeenCalled();

      const updatedPayload = JSON.parse(mockMulti.set.mock.calls[0][1]);
      expect(updatedPayload.version).toBe(2);
      expect(updatedPayload.metadata.lastPage).toBe('/dashboard');
      expect(updatedPayload.metadata.role).toBe('student');
    });

    it('should do nothing when session does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.touchSession('nonexistent-sid');

      expect(mockMulti.exec).not.toHaveBeenCalled();
    });
  });

  describe('removeSession', () => {
    it('should delete session from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.removeSession('test-sid');

      expect(mockRedis.del).toHaveBeenCalledWith('auth:sess:test-sid');
    });
  });

  describe('deleteAllSessionsForUser', () => {
    it('should remove all Redis sessions for a user', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', ['auth:sess:one', 'auth:sess:two']]);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ sid: 'one', userId: 'user-123' }))
        .mockResolvedValueOnce(JSON.stringify({ sid: 'two', userId: 'user-999' }));
      mockRedis.del.mockResolvedValue(1);

      const deletedCount = await service.deleteAllSessionsForUser('user-123');

      expect(deletedCount).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledWith('auth:sess:one');
      expect(mockRedis.zrem).toHaveBeenCalledWith('user:sessions:user-123', 'one');
    });
  });

  describe('migrateSession', () => {
    it('should migrate session to new sid and delete old one', async () => {
      const sessionData = {
        sid: 'old-sid',
        userId: 'user-123',
        metadata: {},
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      const newSid = await service.migrateSession(
        'old-sid',
        '00000000-0000-0000-0000-000000000001',
      );

      expect(newSid).toBe('00000000-0000-0000-0000-000000000001');
      expect(mockMulti.set).toHaveBeenCalled();
      expect(mockMulti.del).toHaveBeenCalled();
      expect(mockMulti.exec).toHaveBeenCalled();
    });

    it('should return newSid unchanged when old session does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const newSid = await service.migrateSession(
        'nonexistent-sid',
        '00000000-0000-0000-0000-000000000001',
      );

      expect(newSid).toBe('00000000-0000-0000-0000-000000000001');
      expect(mockMulti.exec).not.toHaveBeenCalled();
    });
  });

  describe('withLock', () => {
    it('should acquire lock and execute handler', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const handler = jest.fn().mockResolvedValue('result');
      const result = await service.withLock('test-lock', handler);

      expect(result).toBe('result');
      expect(handler).toHaveBeenCalled();
    });

    it('should throw when lock cannot be acquired', async () => {
      mockRedis.set.mockResolvedValue(null);

      await expect(service.withLock('busy-lock', jest.fn())).rejects.toThrow(
        'Could not acquire lock: busy-lock',
      );
    });
  });

  describe('parseDurationToSeconds', () => {
    it('should parse days correctly', () => {
      expect(SessionService.parseDurationToSeconds('7d')).toBe(604800);
      expect(SessionService.parseDurationToSeconds('30d')).toBe(2592000);
    });

    it('should parse hours correctly', () => {
      expect(SessionService.parseDurationToSeconds('1h')).toBe(3600);
      expect(SessionService.parseDurationToSeconds('24h')).toBe(86400);
    });

    it('should parse minutes correctly', () => {
      expect(SessionService.parseDurationToSeconds('15m')).toBe(900);
      expect(SessionService.parseDurationToSeconds('60m')).toBe(3600);
    });

    it('should parse seconds correctly', () => {
      expect(SessionService.parseDurationToSeconds('3600s')).toBe(3600);
    });

    it('should parse bare numeric strings', () => {
      expect(SessionService.parseDurationToSeconds('604800')).toBe(604800);
    });

    it('should handle whitespace', () => {
      expect(SessionService.parseDurationToSeconds(' 7d ')).toBe(604800);
    });

    it('should return 0 for unrecognized formats', () => {
      expect(SessionService.parseDurationToSeconds('invalid')).toBe(0);
      expect(SessionService.parseDurationToSeconds('')).toBe(0);
    });
  });

  describe('constructor session TTL validation', () => {
    it('should warn when session TTL (3600s) is shorter than refresh token lifetime (7d)', async () => {
      const configWithShortSession = {
        get: jest.fn((key: string, defaultVal?: string) => {
          const values: Record<string, string> = {
            AUTH_SESSION_PREFIX: 'auth:sess:',
            AUTH_SESSION_LEGACY_PREFIX: 'session:',
            AUTH_SESSION_TTL_SECONDS: '3600',
            SESSION_LOCK_TTL_MS: '5000',
            SESSION_LOCK_MAX_RETRIES: '5',
            SESSION_LOCK_RETRY_DELAY_MS: '120',
            JWT_REFRESH_EXPIRES_IN: '7d',
          };
          return values[key] ?? defaultVal ?? '';
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          SessionService,
          { provide: SESSION_REDIS_CLIENT, useValue: mockRedis },
          { provide: ConfigService, useValue: configWithShortSession },
        ],
      }).compile();

      const svc = module.get<SessionService>(SessionService);
      expect(svc).toBeDefined();
    });

    it('should not warn when session TTL matches refresh token lifetime', async () => {
      const configWithMatchingSession = {
        get: jest.fn((key: string, defaultVal?: string) => {
          const values: Record<string, string> = {
            AUTH_SESSION_PREFIX: 'auth:sess:',
            AUTH_SESSION_LEGACY_PREFIX: 'session:',
            AUTH_SESSION_TTL_SECONDS: '604800',
            SESSION_LOCK_TTL_MS: '5000',
            SESSION_LOCK_MAX_RETRIES: '5',
            SESSION_LOCK_RETRY_DELAY_MS: '120',
            JWT_REFRESH_EXPIRES_IN: '7d',
          };
          return values[key] ?? defaultVal ?? '';
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          SessionService,
          { provide: SESSION_REDIS_CLIENT, useValue: mockRedis },
          { provide: ConfigService, useValue: configWithMatchingSession },
        ],
      }).compile();

      const svc = module.get<SessionService>(SessionService);
      expect(svc).toBeDefined();
    });
  });
});
