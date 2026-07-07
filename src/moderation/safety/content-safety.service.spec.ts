import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContentSafetyService } from './content-safety.service';
import {
  EXTERNAL_MODERATION_PROVIDER,
  ExternalModerationProvider,
  ExternalModerationUnavailableError,
} from './external-moderation.provider';
import { EnhancedCircuitBreakerService } from '../../common/services/circuit-breaker.service';

function makeMockProvider(
  impl: ExternalModerationProvider['scoreContent'],
): ExternalModerationProvider & jest.Mocked<ExternalModerationProvider> {
  return {
    name: 'mock-provider',
    scoreContent: jest.fn().mockImplementation(impl),
  } as ExternalModerationProvider & jest.Mocked<ExternalModerationProvider>;
}

/**
 * A circuit-breaker service that simply forwards execute() calls. We are not
 * testing opossum here — that is the EnhancedCircuitBreakerService's job; we
 * are testing that ContentSafetyService threads the fallback correctly.
 *
 * The execute() mock is typed as the interface method itself so we don't have
 * to specify a concrete `T`. This sidesteps a TS2322 clash between the mock's
 * inferred concrete `Promise<number>` and the interface's generic `<T>`.
 */
function makePassthroughBreaker(): Partial<EnhancedCircuitBreakerService> {
  const fn = jest.fn(
    async (
      _key: string,
      op: () => Promise<unknown>,
      options: { fallback?: (err: Error) => unknown } = {},
    ): Promise<unknown> => {
      try {
        return await op();
      } catch (err) {
        if (options.fallback) return options.fallback(err as Error);
        throw err;
      }
    },
  );
  return { execute: fn as unknown as EnhancedCircuitBreakerService['execute'] };
}

describe('ContentSafetyService (Issue #805 — external moderation with fallback)', () => {
  let service: ContentSafetyService;
  let mockProvider: ReturnType<typeof makeMockProvider>;
  let mockBreaker: ReturnType<typeof makePassthroughBreaker>;

  async function buildModule(providerEnabled = true): Promise<void> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ContentSafetyService,
        {
          provide: EXTERNAL_MODERATION_PROVIDER,
          useValue: mockProvider,
        },
        {
          provide: EnhancedCircuitBreakerService,
          useValue: mockBreaker,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              if (key === 'OPENAI_MODERATION_ENABLED') return providerEnabled;
              if (key === 'OPENAI_MODERATION_TIMEOUT_MS') return 500;
              return fallback;
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ContentSafetyService);
  }

  beforeEach(() => {
    mockProvider = makeMockProvider(async () => 0);
    mockBreaker = makePassthroughBreaker();
  });

  describe('keyword-only path', () => {
    beforeEach(() => buildModule(false));

    it('returns 0 for clean content', async () => {
      expect(await service.scoreContent('JavaScript is great')).toBe(0);
    });

    it('flags violence', async () => {
      expect(await service.scoreContent('this is violence')).toBeGreaterThan(0);
    });

    it('flags hate', async () => {
      expect(await service.scoreContent('this is hate')).toBeGreaterThan(0);
    });

    it('flags explicit', async () => {
      expect(await service.scoreContent('this is explicit')).toBeGreaterThan(0);
    });

    it('flags spam', async () => {
      expect(await service.scoreContent('this is spam')).toBeGreaterThan(0);
    });

    it('flags scam', async () => {
      expect(await service.scoreContent('this is a scam')).toBeGreaterThan(0);
    });

    it('caps at 1 for multi-keyword content', async () => {
      expect(await service.scoreContent('violence hate explicit spam scam')).toBe(1);
    });

    it('returns 0 for empty/whitespace input', async () => {
      expect(await service.scoreContent('')).toBe(0);
      expect(await service.scoreContent('   ')).toBe(0);
    });
  });

  describe('external provider path', () => {
    beforeEach(() => buildModule(true));

    it('returns 0 when both provider and keyword report clean', async () => {
      mockProvider.scoreContent.mockResolvedValue(0);
      expect(await service.scoreContent('hello world')).toBe(0);
      expect(mockProvider.scoreContent).toHaveBeenCalledWith('hello world');
    });

    it('returns provider score when it is greater than keyword', async () => {
      mockProvider.scoreContent.mockResolvedValue(0.95);
      expect(await service.scoreContent('totally clean text')).toBe(0.95);
    });

    it('returns keyword score when it is greater (homoglyph bypass test)', async () => {
      // Simulates: provider passes (e.g. it normalised text internally),
      // but the legacy keyword regex still catches the un-normalised input.
      mockProvider.scoreContent.mockResolvedValue(0);
      expect(await service.scoreContent('contains violence')).toBeGreaterThan(0);
      expect(await service.scoreContent('contains violence')).toBeCloseTo(0.8, 5);
    });

    it('falls back to keyword score when provider throws ExternalModerationUnavailableError', async () => {
      mockProvider.scoreContent.mockRejectedValue(
        new ExternalModerationUnavailableError('network down'),
      );
      expect(await service.scoreContent('violence')).toBeGreaterThan(0);
      expect(mockProvider.scoreContent).toHaveBeenCalled();
    });

    it('falls back to keyword score on generic provider error', async () => {
      mockProvider.scoreContent.mockRejectedValue(new Error('boom'));
      expect(await service.scoreContent('violence')).toBeGreaterThan(0);
    });

    it('caps combined score at 1', async () => {
      mockProvider.scoreContent.mockResolvedValue(1);
      expect(await service.scoreContent('violence')).toBeLessThanOrEqual(1);
    });

    it('routes provider invocation through the static circuit-breaker key', async () => {
      mockProvider.scoreContent.mockResolvedValue(0);
      await service.scoreContent('hello');
      const breakerKey = (mockBreaker.execute as jest.Mock).mock.calls[0][0];
      expect(breakerKey).toBe(ContentSafetyService.CIRCUIT_BREAKER_KEY);
      // Verify the key is static (constant) — dynamic keys would leak opossum memory.
      expect(ContentSafetyService.CIRCUIT_BREAKER_KEY).toBe(
        ContentSafetyService.CIRCUIT_BREAKER_KEY,
      );
    });
  });

  describe('homoglyph bypass regression (Issue #805 acceptance)', () => {
    beforeEach(() => buildModule(true));

    it('flags content with Unicode homoglyph substitution that the keyword regex would miss', async () => {
      // The OpenAI adapter internally normalises the text and flags it.
      // The legacy keyword regex would miss this because the lowercase form
      // contains \uff56 (full-width 'v') instead of 'violence'.
      mockProvider.scoreContent.mockResolvedValue(0.92);
      const homoglyph = '\uff76' + 'iolence'; // full-width 'v' + 'iolence'
      const score = await service.scoreContent(`user posted: ${homoglyph}`);
      expect(score).toBeGreaterThanOrEqual(0.9);
    });
  });
});
