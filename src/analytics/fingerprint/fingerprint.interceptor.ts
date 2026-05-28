import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { FingerprintService } from './fingerprint.service';
import { AnalyticsService } from '../analytics.service';

/** In-memory deduplication store (TTL-based). */
const seen = new Map<string, number>();
const DEDUP_WINDOW_MS = 60_000;

/** Prune expired entries periodically to avoid unbounded growth. */
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of seen) {
    if (now - ts > DEDUP_WINDOW_MS) seen.delete(key);
  }
}, DEDUP_WINDOW_MS);

@Injectable()
export class FingerprintInterceptor implements NestInterceptor {
  private readonly logger = new Logger(FingerprintInterceptor.name);

  constructor(
    private readonly fingerprintService: FingerprintService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const fingerprint = this.fingerprintService.generate(req);
    const dedupKey = this.fingerprintService.windowedKey(fingerprint.hash, DEDUP_WINDOW_MS);

    // Attach fingerprint hash to request for downstream use
    (req as Request & { fingerprintHash?: string }).fingerprintHash = fingerprint.hash;

    if (!seen.has(dedupKey)) {
      seen.set(dedupKey, Date.now());
      this.analyticsService.recordEvent(
        'request',
        'fingerprint',
        fingerprint.meta.path,
      );
      this.logger.debug(`New fingerprint: ${fingerprint.hash} path=${fingerprint.meta.path}`);
    }

    return next.handle();
  }
}
