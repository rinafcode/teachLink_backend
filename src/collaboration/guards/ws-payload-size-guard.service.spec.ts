import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import {
  WsPayloadSizeGuardService,
  WS_PAYLOAD_TOO_LARGE_CODE,
  DEFAULT_WS_MAX_PAYLOAD_BYTES,
} from './ws-payload-size-guard.service';

describe('WsPayloadSizeGuardService', () => {
  // ---------------------------------------------------------------------------
  // Tests with default limit (64KB)
  // ---------------------------------------------------------------------------
  describe('with default limit', () => {
    let service: WsPayloadSizeGuardService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WsPayloadSizeGuardService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      service = module.get<WsPayloadSizeGuardService>(WsPayloadSizeGuardService);
    });

    it('should use default limit of 64KB', () => {
      expect(service.getMaxPayloadBytes()).toBe(DEFAULT_WS_MAX_PAYLOAD_BYTES);
      expect(service.getMaxPayloadBytes()).toBe(65_536);
    });

    it('should accept a small payload', () => {
      const payload = { sessionId: 'session-1', userId: 'user-1', data: 'hello' };
      expect(() => service.validate(payload)).not.toThrow();
    });

    it('should accept an empty object', () => {
      expect(() => service.validate({})).not.toThrow();
    });

    it('should accept a payload just under the limit', () => {
      // Create a payload that is just under 64KB
      const padding = 'x'.repeat(60_000);
      const payload = { data: padding };
      expect(() => service.validate(payload)).not.toThrow();
    });

    it('should reject a payload exceeding 64KB', () => {
      // Create a payload that is well over 64KB
      const padding = 'x'.repeat(70_000);
      const payload = { data: padding };

      expect(() => service.validate(payload)).toThrow(WsException);

      try {
        service.validate(payload);
      } catch (error) {
        expect(error).toBeInstanceOf(WsException);
        const wsError = error as WsException;
        const errorPayload = wsError.getError() as { code: string; message: string };
        expect(errorPayload.code).toBe(WS_PAYLOAD_TOO_LARGE_CODE);
        expect(errorPayload.message).toContain('exceeds the maximum allowed size');
      }
    });

    it('should reject a large nested object', () => {
      // Build a deeply nested object that exceeds 64KB when serialized
      const largeArray = Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        content: `This is element number ${i} with some additional padding text to increase size`,
        nested: { a: 'value', b: i * 100 },
      }));
      const payload = { operations: largeArray };

      expect(() => service.validate(payload)).toThrow(WsException);
    });

    it('should include PAYLOAD_TOO_LARGE code in the error', () => {
      const padding = 'x'.repeat(70_000);
      const payload = { data: padding };

      try {
        service.validate(payload);
        fail('Expected WsException to be thrown');
      } catch (error) {
        const wsError = error as WsException;
        const errorPayload = wsError.getError() as { code: string; message: string };
        expect(errorPayload.code).toBe('PAYLOAD_TOO_LARGE');
      }
    });

    it('should include byte sizes in the error message', () => {
      const padding = 'x'.repeat(70_000);
      const payload = { data: padding };

      try {
        service.validate(payload);
        fail('Expected WsException to be thrown');
      } catch (error) {
        const wsError = error as WsException;
        const errorPayload = wsError.getError() as { code: string; message: string };
        expect(errorPayload.message).toMatch(/\d+ bytes exceeds/);
        expect(errorPayload.message).toMatch(/maximum allowed size of \d+ bytes/);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Tests with custom limit
  // ---------------------------------------------------------------------------
  describe('with custom limit', () => {
    let service: WsPayloadSizeGuardService;
    const customLimit = 1_024; // 1KB

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WsPayloadSizeGuardService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'WS_MAX_PAYLOAD_BYTES') return customLimit;
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<WsPayloadSizeGuardService>(WsPayloadSizeGuardService);
    });

    it('should use the configured limit', () => {
      expect(service.getMaxPayloadBytes()).toBe(customLimit);
    });

    it('should accept a payload under the custom limit', () => {
      const payload = { key: 'value' };
      expect(() => service.validate(payload)).not.toThrow();
    });

    it('should reject a payload over the custom 1KB limit', () => {
      const padding = 'x'.repeat(2_000);
      const payload = { data: padding };

      expect(() => service.validate(payload)).toThrow(WsException);
    });
  });

  // ---------------------------------------------------------------------------
  // Tests with realistic collaboration payloads
  // ---------------------------------------------------------------------------
  describe('with realistic collaboration payloads', () => {
    let service: WsPayloadSizeGuardService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WsPayloadSizeGuardService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined), // Use default 64KB
            },
          },
        ],
      }).compile();

      service = module.get<WsPayloadSizeGuardService>(WsPayloadSizeGuardService);
    });

    it('should accept a normal collaborative operation', () => {
      const payload = {
        sessionId: 'session-abc-123',
        userId: 'user-456',
        resourceType: 'document',
        operation: {
          type: 'insert',
          position: 42,
          content: 'Hello, this is a normal collaborative edit.',
          revision: 10,
        },
      };
      expect(() => service.validate(payload)).not.toThrow();
    });

    it('should accept a join-session message', () => {
      const payload = {
        sessionId: 'session-abc-123',
        userId: 'user-456',
        resourceType: 'document',
      };
      expect(() => service.validate(payload)).not.toThrow();
    });

    it('should accept a sync-request message', () => {
      const payload = {
        sessionId: 'session-abc-123',
        userId: 'user-456',
      };
      expect(() => service.validate(payload)).not.toThrow();
    });

    it('should reject a malicious megabyte-scale operation payload', () => {
      const maliciousPayload = {
        sessionId: 'session-abc-123',
        userId: 'attacker',
        resourceType: 'document',
        operation: {
          type: 'insert',
          position: 0,
          // 1MB of content — clearly malicious
          content: 'A'.repeat(1_048_576),
        },
      };
      expect(() => service.validate(maliciousPayload)).toThrow(WsException);
    });

    it('should reject a payload with excessive metadata', () => {
      const payload = {
        sessionId: 'session-abc-123',
        userId: 'user-456',
        resourceType: 'document',
        operation: {
          type: 'insert',
          position: 0,
          content: 'small content',
          // Attacker stuffs massive metadata
          metadata: Object.fromEntries(
            Array.from({ length: 5000 }, (_, i) => [`key-${i}`, `value-${'x'.repeat(20)}-${i}`]),
          ),
        },
      };
      expect(() => service.validate(payload)).toThrow(WsException);
    });
  });
});
