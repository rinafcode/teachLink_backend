import { Test, TestingModule } from '@nestjs/testing';
import { ContentSafetyService } from './content-safety.service';

describe('ContentSafetyService', () => {
  let service: ContentSafetyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContentSafetyService],
    }).compile();

    service = module.get<ContentSafetyService>(ContentSafetyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scoreContent', () => {
    it('should return 0 for clean content', () => {
      expect(service.scoreContent('This is a great lesson about JavaScript!')).toBe(0);
    });

    it('should score content containing violence keyword', () => {
      const score = service.scoreContent('This content contains violence');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should score content containing hate keyword', () => {
      const score = service.scoreContent('This content promotes hate');
      expect(score).toBeGreaterThan(0);
    });

    it('should score content containing explicit keyword', () => {
      const score = service.scoreContent('This is explicit material');
      expect(score).toBeGreaterThan(0);
    });

    it('should score content containing spam keyword', () => {
      const score = service.scoreContent('This is spam content');
      expect(score).toBeGreaterThan(0);
    });

    it('should score content containing scam keyword', () => {
      const score = service.scoreContent('This is a scam');
      expect(score).toBeGreaterThan(0);
    });

    it('should cap score at 1 for multiple violations', () => {
      const score = service.scoreContent('violence hate explicit spam scam');
      expect(score).toBe(1);
    });

    it('should be case-insensitive', () => {
      expect(service.scoreContent('VIOLENCE')).toBeGreaterThan(0);
      expect(service.scoreContent('SPAM')).toBeGreaterThan(0);
    });

    it('should return 0 for empty string', () => {
      expect(service.scoreContent('')).toBe(0);
    });
  });
});
