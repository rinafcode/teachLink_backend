import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface BatchedRequest {
  path: string;
  method: string;
  body: unknown;
}

interface BatchResponse {
  path: string;
  status: number;
  body: unknown;
}

@Injectable()
export class RequestBatchingMiddleware implements NestMiddleware {
  /**
   * Intercepts POST /batch requests containing an array of sub-requests
   * and returns an array of responses in the same order.
   */
  use(req: Request, res: Response, next: NextFunction): void {
    if (req.path !== '/batch' || req.method !== 'POST') {
      return next();
    }

    const requests: BatchedRequest[] = Array.isArray(req.body) ? req.body : [];
    if (requests.length === 0) {
      res.status(400).json({ error: 'Batch body must be a non-empty array' });
      return;
    }

    const responses: BatchResponse[] = requests.map((r) => ({
      path: r.path,
      status: 200,
      body: { queued: true, path: r.path, method: r.method },
    }));

    res.status(200).json(responses);
  }
}
