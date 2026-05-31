import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ResourceConflictException } from '../exceptions/app.exceptions';
import { Reflector } from '@nestjs/core';
import { Observable, of, from } from 'rxjs';
import { finalize, map, mergeMap } from 'rxjs/operators';
import { Request, Response } from 'express';
import {
  IdempotencyRecord,
  IdempotencyService,
} from '../services/idempotency.service';
import {
  IDEMPOTENCY_DEFAULT_HEADER_NAME,
  IDEMPOTENCY_DEFAULT_LOCK_TTL_MS,
  IDEMPOTENCY_DEFAULT_POLL_INTERVAL_MS,
  IDEMPOTENCY_DEFAULT_WAIT_TIMEOUT_MS,
  IDEMPOTENCY_METADATA_KEY,
} from '../constants/idempotency.constants';
import { IdempotencyOptions } from '../decorators/idempotency.decorator';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly idempotencyService: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Only apply to POST, PUT, PATCH methods
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return next.handle();
    }

    // Check if endpoint is marked as idempotent
    const options = this.reflector.getAllAndOverride<IdempotencyOptions>(IDEMPOTENCY_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) {
      return next.handle();
    }

    const headerName = (options.headerName ?? IDEMPOTENCY_DEFAULT_HEADER_NAME).toLowerCase();
    const idempotencyKey = this.getHeaderValue(request, headerName);
    if (!idempotencyKey) {
      throw new BadRequestException(
        `${options.headerName ?? IDEMPOTENCY_DEFAULT_HEADER_NAME} header is required for this operation`,
      );
    }

    const routePath = this.getRoutePath(request);
    const scopeKey = this.idempotencyService.buildScopeKey({
      method: request.method,
      routePath,
      idempotencyKey,
    });
    const fingerprint = this.idempotencyService.buildFingerprint({
      method: request.method,
      routePath,
      body: request.body,
      query: request.query,
      params: request.params,
    });

    // Check if request already processed
    const existingRecord = await this.idempotencyService.getRecord(scopeKey);
    if (existingRecord) {
      this.assertFingerprintMatch(existingRecord, fingerprint);
      this.applyCachedResponse(response, existingRecord);
      return of(existingRecord.response);
    }

    // Try to acquire lock
    const lockAcquired = await this.idempotencyService.acquireLock(
      scopeKey,
      fingerprint,
      options.lockTtlMs ?? IDEMPOTENCY_DEFAULT_LOCK_TTL_MS,
    );
    if (!lockAcquired) {
      const lockRecord = await this.idempotencyService.getLockRecord(scopeKey);

      if (lockRecord && lockRecord.fingerprint !== fingerprint) {
        throw new ConflictException('Idempotency key already used for a different payload');
      }

      const cachedRecord = await this.idempotencyService.waitForRecord(
        scopeKey,
        options.waitTimeoutMs ?? IDEMPOTENCY_DEFAULT_WAIT_TIMEOUT_MS,
        options.pollIntervalMs ?? IDEMPOTENCY_DEFAULT_POLL_INTERVAL_MS,
      );

      if (cachedRecord) {
        this.assertFingerprintMatch(cachedRecord, fingerprint);
        this.applyCachedResponse(response, cachedRecord);
        return of(cachedRecord.response);
      }

      throw new ConflictException('Request is being processed, please retry');
    }

    return next.handle().pipe(
      mergeMap((data) =>
        from(
          this.idempotencyService.saveRecord(scopeKey, {
            idempotencyKey: scopeKey,
            fingerprint,
            statusCode: response.statusCode || HttpStatus.OK,
            response: data,
            cachedAt: Date.now(),
            ttlSeconds: options.ttl,
          } as IdempotencyRecord),
        ).pipe(map(() => data)),
      ),
      finalize(() => {
        void this.idempotencyService.releaseLock(scopeKey);
      }),
    );
  }

  private applyCachedResponse(response: Response, record: IdempotencyRecord): void {
    response.status(record.statusCode);
    response.setHeader('X-Idempotent-Replayed', 'true');

    if (record.responseHeaders) {
      for (const [headerName, headerValue] of Object.entries(record.responseHeaders)) {
        response.setHeader(headerName, headerValue);
      }
    }
  }

  private assertFingerprintMatch(record: IdempotencyRecord, fingerprint: string): void {
    if (record.fingerprint !== fingerprint) {
      throw new ConflictException('Idempotency key already used for a different payload');
    }
  }

  private getRoutePath(request: Request): string {
    return `${request.baseUrl || ''}${request.route?.path || request.path || ''}`;
  }

  private getHeaderValue(request: Request, headerName: string): string | undefined {
    const normalizedHeaderName = headerName.toLowerCase();
    const candidates = new Set([
      normalizedHeaderName,
      headerName,
      normalizedHeaderName.startsWith('x-')
        ? normalizedHeaderName.replace(/^x-/, '')
        : `x-${normalizedHeaderName}`,
    ]);

    const headerValue = [...candidates].reduce<string | string[] | undefined>((value, candidate) => {
      if (value !== undefined) {
        return value;
      }

      return request.headers[candidate];
    }, undefined);

    if (Array.isArray(headerValue)) {
      return headerValue[0];
    }

    return typeof headerValue === 'string' ? headerValue : undefined;
  }
}
