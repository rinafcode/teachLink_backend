import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SensitiveOperationsService } from '../services/sensitive-operations.service';
import { SENSITIVE_OPERATION_KEY, ISensitiveOperationOptions } from '../decorators/sensitive-operation.decorator';
import { AuditSeverity } from '../enums/audit-action.enum';

interface IRequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
  requestId?: string;
}

@Injectable()
export class SensitiveOperationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SensitiveOperationInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly sensitiveOpsService: SensitiveOperationsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<ISensitiveOperationOptions>(
      SENSITIVE_OPERATION_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<IRequestWithUser>();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    const { method, path, ip, headers, user, requestId, body, params } = request;

    const userAgent = headers['user-agent'] || 'Unknown';
    const userId = user?.id || null;
    const userEmail = user?.email || null;

    // Extract entity ID from params if specified
    let entityId = options.entityIdParam ? params[options.entityIdParam] : 'unknown';

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.logSensitiveOperation(
            userId,
            userEmail,
            options,
            entityId,
            ip,
            userAgent,
            requestId,
            body,
            data,
            response.statusCode,
            Date.now() - startTime,
          );
        },
        error: (error) => {
          this.logSensitiveOperation(
            userId,
            userEmail,
            options,
            entityId,
            ip,
            userAgent,
            requestId,
            body,
            null,
            error.status || 500,
            Date.now() - startTime,
            error.message,
          );
        },
      }),
      catchError((error) => {
        throw error;
      }),
    );
  }

  private async logSensitiveOperation(
    userId: string | null,
    userEmail: string | null,
    options: ISensitiveOperationOptions,
    entityId: string,
    ipAddress: string,
    userAgent: string,
    requestId: string | undefined,
    requestBody: unknown,
    responseData: unknown,
    statusCode: number,
    responseTimeMs: number,
    errorMessage?: string,
  ): Promise<void> {
    try {
      if (!userId || !userEmail) {
        this.logger.warn('Sensitive operation attempted without authentication');
        return;
      }

      const oldValues = options.logOldValues ? this.extractOldValues(requestBody) : undefined;
      const newValues = options.logNewValues ? this.extractNewValues(requestBody, responseData) : undefined;

      await this.sensitiveOpsService.logSensitiveOperation({
        userId,
        userEmail,
        action: options.action,
        entityType: options.entityType,
        entityId,
        description: options.description || `${options.action} on ${options.entityType}`,
        oldValues,
        newValues,
        ipAddress,
        userAgent,
        requestId,
        metadata: {
          statusCode,
          responseTimeMs,
          errorMessage,
          method: requestBody ? 'POST/PUT/PATCH' : 'GET',
        },
      });
    } catch (error) {
      this.logger.error('Failed to log sensitive operation:', error);
    }
  }

  private extractOldValues(body: unknown): Record<string, unknown> | undefined {
    if (!body || typeof body !== 'object') {
      return undefined;
    }

    const bodyObj = body as Record<string, unknown>;
    const oldValues = bodyObj.oldValues || bodyObj.previous;
    return oldValues as Record<string, unknown> | undefined;
  }

  private extractNewValues(body: unknown, response: unknown): Record<string, unknown> | undefined {
    if (response && typeof response === 'object') {
      const responseObj = response as Record<string, unknown>;
      return (responseObj.data || responseObj) as Record<string, unknown>;
    }

    if (body && typeof body === 'object') {
      const bodyObj = body as Record<string, unknown>;
      return (bodyObj.newValues || bodyObj) as Record<string, unknown>;
    }

    return undefined;
  }
}
