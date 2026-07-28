import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response, NextFunction } from 'express';
import * as http from 'http';
import { MEDIA_UPLOAD_INTERCEPTOR_OPTIONS } from '../../src/media/validation/upload-validation.util';

// Recreate the file size guard from main.ts for accurate e2e testing
function getFileSizeGuard(fileUploadMaxBytes: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.headers['content-type'];
    const contentLengthHeader = req.headers['content-length'];

    const isMultipart =
      typeof contentType === 'string' && contentType.toLowerCase().includes('multipart/form-data');

    if (!isMultipart) return next();

    const contentLengthValue = Array.isArray(contentLengthHeader)
      ? contentLengthHeader[0]
      : contentLengthHeader;

    const contentLength = parseInt(contentLengthValue || '', 10);

    if (Number.isNaN(contentLength)) {
      const transferEncoding = req.headers['transfer-encoding'];
      if (!transferEncoding || !transferEncoding.includes('chunked')) {
        res.status(411).json({
          message: 'Length Required',
        });
        return;
      }
    } else if (contentLength > fileUploadMaxBytes) {
      res.status(413).json({
        message: 'File upload too large',
        maxBytes: fileUploadMaxBytes,
      });
      return;
    }

    let bytesRead = 0;
    req.on('data', (chunk: Buffer) => {
      bytesRead += chunk.length;
      if (bytesRead > fileUploadMaxBytes) {
        req.destroy(new Error('Payload Too Large'));
      }
    });

    next();
  };
}

@Controller('upload')
class UploadController {
  @Post()
  @UseInterceptors(FileInterceptor('file', MEDIA_UPLOAD_INTERCEPTOR_OPTIONS))
  uploadFile(@UploadedFile() file: any) {
    return { success: true, size: file?.size };
  }
}

describe('Upload Size Guard Bypass Security (e2e)', () => {
  let app: INestApplication;
  const maxBytes = 100;
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    process.env.FILE_UPLOAD_MAX_BYTES = '100';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(getFileSizeGuard(maxBytes));

    await app.init();

    server = app.getHttpServer();
    server.listen(0);
    port = (server.address() as any).port;
  });

  afterAll(async () => {
    await app.close();
  });

  const sendRawRequest = (
    headers: any,
    bodyChunks: Buffer[],
  ): Promise<{ status?: number; error?: Error }> => {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port,
        path: '/upload',
        method: 'POST',
        headers,
      };

      const req = http.request(options, (res) => {
        resolve({ status: res.statusCode });
      });

      req.on('error', (e) => {
        resolve({ error: e });
      });

      bodyChunks.forEach((chunk) => req.write(chunk));
      req.end();
    });
  };

  it('should reject a chunked multipart upload exceeding the limit', async () => {
    const boundary = '---boundary';
    const payload = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\n\r\n${'A'.repeat(200)}\r\n--${boundary}--\r\n`,
    );

    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Transfer-Encoding': 'chunked',
    };

    const result = await sendRawRequest(headers, [payload]);

    // When req.destroy() is called, it causes a socket hang up (ECONNRESET) on the client side.
    expect(result.error).toBeDefined();
    if (result.error) {
      expect(result.error.message).toMatch(/socket hang up|ECONNRESET/);
    }
  });

  it('should reject an understated Content-Length exceeding the limit', async () => {
    const boundary = '---boundary';
    const payload = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\n\r\n${'A'.repeat(200)}\r\n--${boundary}--\r\n`,
    );

    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': '10', // Understated!
    };

    const result = await sendRawRequest(headers, [payload]);

    expect(result.error).toBeDefined();
    if (result.error) {
      expect(result.error.message).toMatch(/socket hang up|ECONNRESET/);
    }
  });
});
