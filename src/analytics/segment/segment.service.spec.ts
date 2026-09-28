import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SegmentService } from './segment.service';

// Mock the Segment SDK
const mockTrack = jest.fn();
const mockIdentify = jest.fn();
const mockCloseAndFlush = jest.fn().mockResolvedValue(undefined);

jest.mock('@segment/analytics-node', () => ({
  Analytics: jest.fn().mockImplementation(() => ({
    track: mockTrack,
    identify: mockIdentify,
    closeAndFlush: mockCloseAndFlush,
  })),
}));

describe('SegmentService', () => {
  let service: SegmentService;

  const buildService = async (writeKey?: string) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SegmentService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(writeKey) },
        },
      ],
    }).compile();
    return module.get<SegmentService>(SegmentService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when SEGMENT_WRITE_KEY is set', () => {
    beforeEach(async () => {
      service = await buildService('test-write-key');
    });

    it('should call client.track with correct payload', () => {
      service.track({ userId: 'u1', event: 'Course Enrolled', properties: { courseId: 'c1' } });
      expect(mockTrack).toHaveBeenCalledWith({
        userId: 'u1',
        event: 'Course Enrolled',
        properties: { courseId: 'c1' },
      });
    });

    it('should include anonymousId in track when provided', () => {
      service.track({ userId: 'u1', event: 'Page Viewed', anonymousId: 'anon-1' });
      expect(mockTrack).toHaveBeenCalledWith(expect.objectContaining({ anonymousId: 'anon-1' }));
    });

    it('should call client.identify with correct payload', () => {
      service.identify({ userId: 'u1', traits: { email: 'a@b.com', plan: 'pro' } });
      expect(mockIdentify).toHaveBeenCalledWith({
        userId: 'u1',
        traits: { email: 'a@b.com', plan: 'pro' },
      });
    });

    it('should include anonymousId in identify when provided', () => {
      service.identify({ userId: 'u1', anonymousId: 'anon-1' });
      expect(mockIdentify).toHaveBeenCalledWith(expect.objectContaining({ anonymousId: 'anon-1' }));
    });

    it('should flush on module destroy', async () => {
      await service.onModuleDestroy();
      expect(mockCloseAndFlush).toHaveBeenCalled();
    });
  });

  describe('when SEGMENT_WRITE_KEY is not set', () => {
    beforeEach(async () => {
      service = await buildService(undefined);
    });

    it('should not call track', () => {
      service.track({ userId: 'u1', event: 'Test' });
      expect(mockTrack).not.toHaveBeenCalled();
    });

    it('should not call identify', () => {
      service.identify({ userId: 'u1' });
      expect(mockIdentify).not.toHaveBeenCalled();
    });

    it('should not call closeAndFlush on destroy', async () => {
      await service.onModuleDestroy();
      expect(mockCloseAndFlush).not.toHaveBeenCalled();
    });
  });
});
