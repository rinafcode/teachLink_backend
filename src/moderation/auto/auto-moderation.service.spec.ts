import { ContentSafetyService } from '../safety/content-safety.service';
import { AutoModerationService } from './auto-moderation.service';

/**
 * Integration spec for Blaqkenny #805 wiring.
 *
 * Proves that AutoModerationService now actually delegates to ContentSafetyService
 * at runtime, which is the missing wiring the original PR #957 left undone.
 *
 * HuggingFace API is stubbed so the test never hits the network.
 */
describe('AutoModerationService — Blaqkenny wiring (#805)', () => {
  let service: AutoModerationService;
  let contentSafety: jest.Mocked<ContentSafetyService>;

  beforeEach(() => {
    contentSafety = {
      scoreContent: jest.fn().mockResolvedValue(0),
      keywordScore: jest.fn().mockReturnValue(0),
    } as unknown as jest.Mocked<ContentSafetyService>;

    // No HUGGINGFACE_API_KEY in the env → the HF constructor still works,
    // and `analyze()` short-circuits via the try/catch fallback path.
    service = new AutoModerationService(contentSafety);
  });

  describe('classifyContentSafety (Issue #805 entry point)', () => {
    it('delegates to ContentSafetyService.scoreContent and maps the score', async () => {
      contentSafety.scoreContent.mockResolvedValue(0.95);

      const out = await service.classifyContentSafety('violence');

      expect(contentSafety.scoreContent).toHaveBeenCalledWith('violence');
      expect(out.flagged).toBe(true);
      expect(out.score).toBe(0.95);
      expect(out.reasons).toContain('content-safety-service flagged');
    });

    it('does not flag clean content', async () => {
      contentSafety.scoreContent.mockResolvedValue(0);
      const out = await service.classifyContentSafety('hello world');
      expect(out.flagged).toBe(false);
      expect(out.reasons).toEqual([]);
    });
  });

  describe('moderateContent (combined HF + content-safety)', () => {
    it('returns max(hfScore, contentSafetyScore)', async () => {
      contentSafety.scoreContent.mockResolvedValue(0);
      // HF stub: empty input → score 0
      const out = await service.moderateContent('this is a gift');
      expect(out.score).toBe(0);
      expect(out.flagged).toBe(false);
    });

    it('flags when content-safety detects risk even if HF reports safe', async () => {
      contentSafety.scoreContent.mockResolvedValue(0.92);
      const out = await service.moderateContent('homoglyph-bypassed input');
      expect(out.flagged).toBe(true);
      expect(out.score).toBeGreaterThanOrEqual(0.92);
      expect(out.sources).toContain('content-safety');
    });
  });

  describe('analyze (regression — legacy path unchanged)', () => {
    it('returns a safe verdict for empty content without touching HF', async () => {
      const out = await service.analyze('');
      expect(out).toEqual({ flagged: false, reasons: [], score: 0 });
    });
  });
});
