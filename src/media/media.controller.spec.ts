import { UnsupportedMediaTypeException } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

describe('MediaController', () => {
  let controller: MediaController;
  let mediaService: { createFromUpload: jest.Mock };

  beforeEach(() => {
    mediaService = {
      createFromUpload: jest.fn(),
    };

    controller = new MediaController(mediaService as unknown as MediaService);
  });

  it('rejects uploads blocked by the MIME whitelist', async () => {
    await expect(
      controller.upload(
        undefined as any,
        {
          uploadValidationError: {
            message: 'File type "application/x-msdownload" is not allowed',
          },
        } as any,
      ),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
  });

  it('passes validated files to the media service with enforced scanning', async () => {
    const file = {
      originalname: 'avatar.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('png'),
    };
    const req = {
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
      },
    };

    mediaService.createFromUpload.mockResolvedValue({ content: { contentId: 'content-1' } });

    await expect(
      controller.upload(file as any, req, {
        compress: 'false',
        generateThumbnails: 'true',
      }),
    ).resolves.toEqual({ content: { contentId: 'content-1' } });

    expect(mediaService.createFromUpload).toHaveBeenCalledWith('user-1', 'tenant-1', file, {
      compress: false,
      generateThumbnails: true,
      trackProgress: true,
    });
  });
});
