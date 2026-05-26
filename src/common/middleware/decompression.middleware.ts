import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createGunzip, createBrotliDecompress, createInflate } from 'zlib';
import { Transform } from 'stream';

/**
 * Decompression middleware for handling compressed request payloads.
 * Supports: gzip, brotli, and deflate compression.
 *
 * This middleware automatically decompresses request bodies based on the
 * Content-Encoding header and restores the Content-Length header accordingly.
 */
@Injectable()
export class DecompressionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(DecompressionMiddleware.name);

  /**
   * Map of supported content encodings to their decompression streams
   */
  private readonly decompressors: Record<string, () => Transform> = {
    gzip: () => createGunzip(),
    'x-gzip': () => createGunzip(),
    deflate: () => createInflate(),
    br: () => createBrotliDecompress(),
  };

  use(req: Request, res: Response, next: NextFunction): void {
    const contentEncoding = req.headers['content-encoding'];

    // If no content encoding or not a supported type, pass through
    if (!contentEncoding || typeof contentEncoding !== 'string') {
      next();
      return;
    }

    // Normalize content encoding to lowercase
    const encoding = contentEncoding.toLowerCase().trim();

    // Check if this encoding is supported
    if (!this.decompressors[encoding]) {
      this.logger.debug(
        `Unsupported Content-Encoding: ${encoding}. Passing request through without decompression.`,
      );
      next();
      return;
    }

    // Don't decompress if there's no body
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') {
      next();
      return;
    }

    this.logger.debug(`Decompressing request with encoding: ${encoding}`);

    try {
      // Get the decompression stream
      const decompressor = this.decompressors[encoding]();

      // Track decompressed data to calculate new content length
      let decompressedLength = 0;
      const dataTracker = new Transform({
        transform(chunk: Buffer, encoding: string, callback: Function) {
          decompressedLength += chunk.length;
          callback(null, chunk);
        },
      });

      // Handle errors during decompression
      decompressor.on('error', (error) => {
        this.logger.error(`Decompression error for encoding ${encoding}:`, error.message);
        res.status(400).json({
          statusCode: 400,
          message: `Failed to decompress request body with encoding: ${encoding}`,
          error: 'Bad Request',
        });
      });

      dataTracker.on('error', (error) => {
        this.logger.error('Error tracking decompressed data:', error.message);
        res.status(400).json({
          statusCode: 400,
          message: 'Error processing decompressed request',
          error: 'Bad Request',
        });
      });

      // Remove Content-Encoding header after successful decompression setup
      delete req.headers['content-encoding'];

      // Remove Content-Length header since we're modifying the body
      // The express json/urlencoded middleware will handle setting it
      delete req.headers['content-length'];

      // Pipe the incoming request through decompression
      req.pipe(decompressor).pipe(dataTracker).pipe(req);

      // Update the request to indicate it's been handled
      req.on('data', () => {
        // Data is being piped through
      });

      next();
    } catch (error) {
      this.logger.error(`Failed to setup decompression for encoding ${encoding}:`, error);
      res.status(400).json({
        statusCode: 400,
        message: `Decompression setup failed for encoding: ${encoding}`,
        error: 'Bad Request',
      });
    }
  }
}
