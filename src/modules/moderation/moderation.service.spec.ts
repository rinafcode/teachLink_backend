import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { ModerationService } from './moderation.service';

const mockHttpService = { post: jest.fn() };
const mockConfigService = { get: jest.fn() };

describe('ModerationService', () => {
  let service: ModerationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue(''); // no API key by default

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
  });

  describe('clean content', () => {
    it('allows clean content', async () => {
      const result = await service.moderate('This is a great course!');
      expect(result.allowed).toBe(true);
      expect(result.autoRejected).toBe(false);
      expect(result.flags).toHaveLength(0);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('profanity filter', () => {
    it('flags content with profanity', async () => {
      const result = await service.moderate('This is fucking terrible');
      expect(result.allowed).toBe(false);
      expect(result.autoRejected).toBe(true);
      expect(result.flags).toContain('profanity');
    });

    it('is case-insensitive', async () => {
      const result = await service.moderate('SHIT happens');
      expect(result.flags).toContain('profanity');
    });
  });

  describe('spam detection', () => {
    it('flags repeated characters', async () => {
      const result = await service.moderate('heeeeeeeeeeello world');
      expect(result.flags).toContain('spam');
    });

    it('flags 3 or more URLs', async () => {
      const result = await service.moderate('Visit http://a.com and http://b.com and http://c.com');
      expect(result.flags).toContain('spam');
    });

    it('allows content with fewer than 3 URLs', async () => {
      const result = await service.moderate('Check http://a.com for details');
      expect(result.flags).not.toContain('spam');
    });

    it('flags known spam phrases', async () => {
      const result = await service.moderate('Buy now and make money fast!');
      expect(result.flags).toContain('spam');
    });

    it('flags excessive uppercase', async () => {
      const result = await service.moderate('THIS IS ALL CAPS SHOUTING AT YOU');
      expect(result.flags).toContain('spam');
    });
  });

  describe('OpenAI integration', () => {
    async function makeServiceWithKey(key: string): Promise<ModerationService> {
      mockConfigService.get.mockReturnValue(key);
      const mod = await Test.createTestingModule({
        providers: [
          ModerationService,
          { provide: HttpService, useValue: mockHttpService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      return mod.get<ModerationService>(ModerationService);
    }

    it('flags content when OpenAI returns flagged=true', async () => {
      const svc = await makeServiceWithKey('sk-test-key');
      mockHttpService.post.mockReturnValue(of({ data: { results: [{ flagged: true }] } }));
      const result = await svc.moderate('some harmful content');
      expect(result.flags).toContain('openai_violation');
      expect(result.allowed).toBe(false);
    });

    it('allows content when OpenAI returns flagged=false', async () => {
      const svc = await makeServiceWithKey('sk-test-key');
      mockHttpService.post.mockReturnValue(of({ data: { results: [{ flagged: false }] } }));
      const result = await svc.moderate('normal content here');
      expect(result.flags).not.toContain('openai_violation');
      expect(result.allowed).toBe(true);
    });

    it('does not reject when OpenAI call fails (graceful degradation)', async () => {
      const svc = await makeServiceWithKey('sk-test-key');
      mockHttpService.post.mockReturnValue(throwError(() => new Error('network error')));
      const result = await svc.moderate('normal content here');
      expect(result.flags).not.toContain('openai_violation');
      expect(result.allowed).toBe(true);
    });

    it('skips OpenAI check when no API key configured', async () => {
      const svc = await makeServiceWithKey('');
      await svc.moderate('clean content');
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });
  });

  describe('auto-reject', () => {
    it('auto-rejects and includes reason when any flag is set', async () => {
      const result = await service.moderate('buy now and make money fast!');
      expect(result.autoRejected).toBe(true);
      expect(result.reason).toBeTruthy();
    });

    it('accumulates multiple flags', async () => {
      // profanity + spam phrase
      const result = await service.moderate('buy now you fucking idiot');
      expect(result.flags).toContain('profanity');
      expect(result.flags).toContain('spam');
      expect(result.flags.length).toBeGreaterThanOrEqual(2);
    });
  });
});
