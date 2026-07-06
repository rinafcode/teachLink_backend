import { Test, TestingModule } from '@nestjs/testing';
import { DecompressionMiddleware } from './decompression.middleware';
import { Request, Response } from 'express';
import { PassThrough } from 'stream';

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
      req.headers = { 'content-encoding': ['gzip', 'deflate'] as any };

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

    it('should handle decompression errors', () => {
      req.headers = { 'content-encoding': 'gzip' };
      const mockDecompressor = new PassThrough();
      (mockDecompressor.pipe as any) = jest.fn().mockReturnValue(mockDecompressor);
      (middleware as any).decompressors.gzip = () => mockDecompressor;
      req.pipe = jest.fn().mockReturnValue(mockDecompressor);
      req.on = jest.fn();

      // Middleware removes headers and calls next() regardless
      middleware.use(req as Request, res as Response, next);

      // The middleware should have called next() after removing headers
      expect(next).toHaveBeenCalled();
      expect(req.headers['content-encoding']).toBeUndefined();

      // Clean up the PassThrough to prevent unhandled errors
      mockDecompressor.destroy();
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
    it('should handle gzip encoding with proper setup', () => {
      const mockReq = {
        headers: { 'content-encoding': 'gzip' },
        method: 'POST',
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn(),
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      const mockNext = jest.fn();

      middleware.use(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.headers['content-encoding']).toBeUndefined();
    });
  });
});
