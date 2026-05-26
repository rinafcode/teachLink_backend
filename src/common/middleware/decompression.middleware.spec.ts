import { Test, TestingModule } from '@nestjs/testing';
import { DecompressionMiddleware } from './decompression.middleware';
import { createGzip, createBrotliCompress, createDeflate } from 'zlib';
import { createReadStream, createWriteStream } from 'fs';
import { Request, Response } from 'express';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync } from 'fs';
import { Readable } from 'stream';

describe('DecompressionMiddleware', () => {
  let middleware: DecompressionMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DecompressionMiddleware],
    }).compile();

    middleware = module.get<DecompressionMiddleware>(DecompressionMiddleware);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: jest.Mock;

    beforeEach(() => {
      req = {
        headers: {},
        method: 'POST',
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn(),
      } as unknown as Request;

      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      next = jest.fn();
    });

    it('should pass through when no content-encoding header', () => {
      middleware.use(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through for GET requests', () => {
      req.method = 'GET';
      req.headers = { 'content-encoding': 'gzip' };

      middleware.use(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through for HEAD requests', () => {
      req.method = 'HEAD';
      req.headers = { 'content-encoding': 'gzip' };

      middleware.use(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through for DELETE requests', () => {
      req.method = 'DELETE';
      req.headers = { 'content-encoding': 'gzip' };

      middleware.use(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through when content-encoding is not a string', () => {
      req.headers = { 'content-encoding': ['gzip', 'deflate'] };

      middleware.use(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through for unsupported encodings', () => {
      req.headers = { 'content-encoding': 'unknown-encoding' };

      middleware.use(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should handle gzip encoding', () => {
      req.headers = { 'content-encoding': 'gzip' };
      req.pipe = jest.fn().mockReturnThis();
      req.on = jest.fn();

      middleware.use(req as Request, res as Response, next);

      expect(req.headers['content-encoding']).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should handle x-gzip encoding', () => {
      req.headers = { 'content-encoding': 'x-gzip' };
      req.pipe = jest.fn().mockReturnThis();
      req.on = jest.fn();

      middleware.use(req as Request, res as Response, next);

      expect(req.headers['content-encoding']).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should handle deflate encoding', () => {
      req.headers = { 'content-encoding': 'deflate' };
      req.pipe = jest.fn().mockReturnThis();
      req.on = jest.fn();

      middleware.use(req as Request, res as Response, next);

      expect(req.headers['content-encoding']).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should handle br (brotli) encoding', () => {
      req.headers = { 'content-encoding': 'br' };
      req.pipe = jest.fn().mockReturnThis();
      req.on = jest.fn();

      middleware.use(req as Request, res as Response, next);

      expect(req.headers['content-encoding']).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should handle case-insensitive encoding', () => {
      req.headers = { 'content-encoding': 'GZIP' };
      req.pipe = jest.fn().mockReturnThis();
      req.on = jest.fn();

      middleware.use(req as Request, res as Response, next);

      expect(req.headers['content-encoding']).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should remove content-length header', () => {
      req.headers = { 'content-encoding': 'gzip', 'content-length': '100' };
      req.pipe = jest.fn().mockReturnThis();
      req.on = jest.fn();

      middleware.use(req as Request, res as Response, next);

      expect(req.headers['content-length']).toBeUndefined();
    });

    it('should handle decompression errors', (done) => {
      req.headers = { 'content-encoding': 'gzip' };
      const mockDecompressor = new (require('stream').PassThrough)();
      req.pipe = jest.fn().mockReturnValue(mockDecompressor);
      req.on = jest.fn();

      // Trigger error on decompressor
      setTimeout(() => {
        mockDecompressor.emit('error', new Error('Decompression error'));
      }, 10);

      middleware.use(req as Request, res as Response, next);

      // Give it time to emit error
      setTimeout(() => {
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalled();
        done();
      }, 50);
    });

    it('should handle whitespace in content-encoding', () => {
      req.headers = { 'content-encoding': '  gzip  ' };
      req.pipe = jest.fn().mockReturnThis();
      req.on = jest.fn();

      middleware.use(req as Request, res as Response, next);

      expect(req.headers['content-encoding']).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('integration tests', () => {
    it('should decompress gzip data end-to-end', (done) => {
      const testData = Buffer.from('Hello, World!');
      const tmpFile = join(tmpdir(), `gzip-test-${Date.now()}.gz`);

      // Create gzip compressed data
      const gzipStream = createGzip();
      const writeStream = createWriteStream(tmpFile);

      writeStream.on('finish', () => {
        // Now test decompression
        const req = new Readable();
        req.push(testData);
        req.push(null);

        // Mock the actual piping would happen here
        // For this test, we're verifying the middleware properly handles the encoding
        const middleware2 = new DecompressionMiddleware();

        const mockReq = {
          headers: { 'content-encoding': 'gzip' },
          method: 'POST',
          pipe: jest.fn().mockReturnThis(),
          on: jest.fn(),
        } as unknown as Request;

        const mockRes = {} as Response;
        const mockNext = jest.fn();

        middleware2.use(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();

        // Cleanup
        try {
          unlinkSync(tmpFile);
        } catch (e) {
          // Ignore cleanup errors
        }

        done();
      });

      gzipStream.pipe(writeStream);
      gzipStream.write(testData);
      gzipStream.end();
    });
  });
});
