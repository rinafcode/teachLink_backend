import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../audit-log.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../enums/audit-action.enum';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
  requestId?: string;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    const { method, path, ip, headers, user, requestId } = request;

    const userAgent = headers['user-agent'] || 'Unknown';
    const userId = user?.id || null;
    const userEmail = user?.email || null;

    return next.handle().pipe(
      tap({
        next: () => {
          this.logRequest(
            userId,
            userEmail,
            path,
            method,
            response.statusCode,
            Date.now() - startTime,
            ip,
            userAgent,
            requestId,
          );
        },
        error: (error) => {
          const statusCode = error.status || 500;
          this.logRequest(
            userId,
            userEmail,
            path,
            method,
            statusCode,
            Date.now() - startTime,
            ip,
            userAgent,
            requestId,
            error.message,
          );
        },
      }),
    );
  }

  private async logRequest(
    userId: string | null,
    userEmail: string | null,
    apiEndpoint: string,
    httpMethod: string,
    statusCode: number,
    responseTimeMs: number,
    ipAddress: string,
    userAgent: string,
    requestId?: string,
    errorMessage?: string,
  ): Promise<void> {
    try {
      // Skip logging for health checks and static assets
      if (this.shouldSkipLogging(apiEndpoint)) {
        return;
      }

      const severity =
        statusCode >= 500
          ? AuditSeverity.ERROR
          : statusCode >= 400
            ? AuditSeverity.WARNING
            : AuditSeverity.INFO;

      await this.auditLogService.log({
        userId: userId || undefined,
        userEmail: userEmail || undefined,
        action: AuditAction.API_CALLED,
        category: AuditCategory.DATA_ACCESS,
        severity,
        apiEndpoint,
        httpMethod,
        statusCode,
        responseTimeMs,
        ipAddress,
        userAgent,
        requestId,
        description: errorMessage || `${httpMethod} ${apiEndpoint} - ${statusCode}`,
      });
    } catch (error) {
      this.logger.error('Failed to log audit entry:', error);
    }
  }

  private shouldSkipLogging(endpoint: string): boolean {
    const skipPatterns = [
      /^\/health/,
      /^\/favicon/,
      /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/,
    ];

    return skipPatterns.some((pattern) => pattern.test(endpoint));
  }
}
