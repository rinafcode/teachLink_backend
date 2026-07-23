import { Test, TestingModule } from '@nestjs/testing';
import { CdnService } from './cdn.service';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as fileType from 'file-type';

jest.mock('@aws-sdk/client-cloudfront');
jest.mock('file-type');
describe('CdnService', () => {
  let service: CdnService;
  let cfClientSendMock: jest.Mock;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    cfClientSendMock = jest.fn().mockResolvedValue({});
    (CloudFrontClient as jest.Mock).mockImplementation(() => ({
      send: cfClientSendMock,
    }));

    // Mock resolveCdnConfig via process.env
    process.env.CDN_ENABLED = 'true';
    process.env.CLOUDFRONT_DISTRIBUTION_ID = 'TEST_DIST_ID';

    const module: TestingModule = await Test.createTestingModule({
      providers: [CdnService],
    }).compile();

    service = module.get<CdnService>(CdnService);
  });

  afterEach(() => {
    delete process.env.CDN_ENABLED;
    delete process.env.CLOUDFRONT_DISTRIBUTION_ID;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('invalidate', () => {
    it('should call CloudFront CreateInvalidationCommand with correct paths', async () => {
      const paths = ['/course/123/video.mp4', '/course/123/notes.pdf'];
      const result = await service.invalidate(paths);
      expect(result.success).toBe(true);
      expect(cfClientSendMock).toHaveBeenCalledTimes(1);

      // Verify the correct command was passed to the send method
      const commandCalled = cfClientSendMock.mock.calls[0][0];
      expect(commandCalled).toBeInstanceOf(CreateInvalidationCommand);
      expect(commandCalled.input.DistributionId).toBe('TEST_DIST_ID');
      expect(commandCalled.input.InvalidationBatch.Paths.Items).toEqual(paths);
      expect(commandCalled.input.InvalidationBatch.Paths.Quantity).toBe(paths.length);
    });

    it('should handle CDN disabled gracefully', async () => {
      process.env.CDN_ENABLED = 'false';

      // Need to re-instantiate service to pick up new env var if cdn config is resolved on init
      const module: TestingModule = await Test.createTestingModule({
        providers: [CdnService],
      }).compile();
      const disabledService = module.get<CdnService>(CdnService);

      const paths = ['/test/path'];
      const result = await disabledService.invalidate(paths);
      expect(result.success).toBe(false);
      expect(result.message).toBe('CDN not configured');
      expect(cfClientSendMock).not.toHaveBeenCalled();
    });

    it('should open circuit breaker or handle error when CloudFront fails', async () => {
      cfClientSendMock.mockRejectedValue(new Error('CloudFront error'));
      const paths = ['/test/path'];
      const result = await service.invalidate(paths);
      expect(result.success).toBe(false);
      expect(result.message).toBe('CDN invalidation failed');
    });
  });

  describe('validateUpload', () => {
    it('should throw Payload Too Large for oversized video files', async () => {
      const buffer = Buffer.alloc(500 * 1024 * 1024 + 1); // 500MB + 1 byte
      await expect(service.validateUpload(buffer, 'video/mp4')).rejects.toThrow(
        new HttpException('Payload Too Large', HttpStatus.PAYLOAD_TOO_LARGE),
      );
    });

    it('should throw Payload Too Large for oversized image files', async () => {
      const buffer = Buffer.alloc(10 * 1024 * 1024 + 1); // 10MB + 1 byte
      await expect(service.validateUpload(buffer, 'image/jpeg')).rejects.toThrow(
        new HttpException('Payload Too Large', HttpStatus.PAYLOAD_TOO_LARGE),
      );
    });

    it('should throw Unsupported Media Type if magic bytes mismatch', async () => {
      const buffer = Buffer.alloc(1024);
      (fileType.fromBuffer as jest.Mock).mockResolvedValue({ mime: 'application/x-php' });
      await expect(service.validateUpload(buffer, 'video/mp4')).rejects.toThrow(
        new HttpException('Unsupported Media Type', HttpStatus.UNSUPPORTED_MEDIA_TYPE),
      );
    });

    it('should pass if size and magic bytes are valid', async () => {
      const buffer = Buffer.alloc(1024);
      (fileType.fromBuffer as jest.Mock).mockResolvedValue({ mime: 'video/mp4' });
      await expect(service.validateUpload(buffer, 'video/mp4')).resolves.toBeUndefined();
    });
  });
});

