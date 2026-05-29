import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { RequestCaptureService } from '../services/request-capture.service';
import { PerformanceTimelineService } from '../services/performance-timeline.service';
import { StackTraceService } from '../services/stack-trace.service';
import { ICapturedResponse, IDebugRecord } from '../interfaces/debug.interfaces';

/** Request augmented with the per-request timeline + debug id. */
export interface IDebuggableRequest extends Request {
  debugId?: string;
  timeline?: ReturnType<PerformanceTimelineService['create']>;
}

/**
 * Captures every request/response exchange, builds a performance timeline and
 * enhances any error before storing the record for later inspection/replay.
 *
 * Designed to be mounted only in non-production environments (wired up by the
 * module) so it never adds overhead to real traffic.
 */
@Injectable()
export class DebugCaptureMiddleware implements NestMiddleware {
  private readonly logger = new Logger(DebugCaptureMiddleware.name);

  constructor(
    private readonly capture: RequestCaptureService,
    private readonly timelines: PerformanceTimelineService,
    private readonly stackTraces: StackTraceService,
  ) {}

  use(req: IDebuggableRequest, res: Response, next: NextFunction): void {
    const debugId = randomUUID();
    const timeline = this.timelines.create(debugId);

    // Expose to downstream layers so controllers/services can add spans.
    req.debugId = debugId;
    req.timeline = timeline;
    res.setHeader('x-debug-id', debugId);

    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ??
      (req.headers['x-request-id'] as string | undefined);

    // Buffer the response body by patching res.send/json without breaking the
    // normal response flow.
    let responseBody: unknown;
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    (res as any).json = (body: unknown) => {
      responseBody = body;
      return originalJson(body);
    };
    (res as any).send = (body: unknown) => {
      if (responseBody === undefined) responseBody = body;
      return originalSend(body);
    };

    const finalize = (error?: unknown) => {
      // Guard against double invocation (finish + error can both fire).
      if (res.locals.__debugRecorded) return;
      res.locals.__debugRecorded = true;

      const response: ICapturedResponse = {
        statusCode: res.statusCode,
        headers: this.flattenHeaders(res.getHeaders()),
        body: responseBody,
      };

      const record: IDebugRecord = {
        id: debugId,
        correlationId,
        timestamp: new Date().toISOString(),
        request: {
          method: req.method,
          url: req.originalUrl,
          path: req.path,
          query: { ...req.query },
          headers: this.flattenHeaders(req.headers),
          body: req.body,
          ip: req.ip,
        },
        response,
        timeline: timeline.build(),
        error: error ? this.stackTraces.enhance(error) : undefined,
      };

      try {
        this.capture.store(record);
      } catch (storeErr) {
        this.logger.warn(`Failed to store debug record: ${String(storeErr)}`);
      }
    };

    res.on('finish', () => finalize());
    res.on('error', (err) => finalize(err));

    next();
  }

  private flattenHeaders(
    headers: Record<string, unknown> | NodeJS.Dict<string | string[] | number>,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined) continue;
      out[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }
    return out;
  }
}
