import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { IdempotencyService } from '../services/idempotency.service';
import { IDEMPOTENCY_KEY_METADATA } from '../decorators/idempotency.decorator';

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
    const ttl = this.reflector.get<number>(IDEMPOTENCY_KEY_METADATA, context.getHandler());
    if (!ttl) {
      return next.handle();
    }

    // Get idempotency key from header
    const idempotencyKey = request.headers['x-idempotency-key'] as string;
    if (!idempotencyKey) {
      throw new HttpException(
        'X-Idempotency-Key header is required for this operation',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if request already processed
    const existingRecord = await this.idempotencyService.getRecord(idempotencyKey);
    if (existingRecord) {
      response.status(existingRecord.statusCode);
      return of(existingRecord.response);
    }

    // Try to acquire lock
    const lockAcquired = await this.idempotencyService.acquireLock(idempotencyKey);
    if (!lockAcquired) {
      throw new HttpException('Request is being processed, please wait', HttpStatus.CONFLICT);
    }

    try {
      // Process the request
      return next.handle().pipe(
        tap(async (data) => {
          // Save successful response
          await this.idempotencyService.saveRecord(idempotencyKey, {
            idempotencyKey,
            statusCode: response.statusCode || HttpStatus.OK,
            response: data,
            timestamp: Date.now(),
            ttl,
          });
        }),
        catchError(async (error) => {
          // Release lock on error
          await this.idempotencyService.releaseLock(idempotencyKey);
          return throwError(() => error);
        }),
      );
    } catch (error) {
      await this.idempotencyService.releaseLock(idempotencyKey);
      throw error;
    }
  }
}
