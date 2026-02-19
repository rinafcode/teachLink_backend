import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataLoaderService } from '../services/dataloader.service';

/**
 * Middleware to inject DataLoaders into request context
 * Creates fresh loaders for each request to ensure proper caching scope
 */
@Injectable()
export class DataLoaderMiddleware implements NestMiddleware {
  constructor(private readonly dataLoaderService: DataLoaderService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Attach loaders to request object for GraphQL context
    (req as any).loaders = this.dataLoaderService.createLoaders();
    next();
  }
}
