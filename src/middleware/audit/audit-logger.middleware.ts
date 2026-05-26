import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditSeverity } from '../../audit-log/enums/audit-action.enum';
import { resolveUserAction } from './user-action-tracker';

interface IRequestWithUser extends Request {
  user?: {
    id?: string;
    email?: string;
  };
  requestId?: string;
}

const logger = new Logger('AuditLoggerMiddleware');

const SKIP_PATTERNS = [/^\/health/, /^\/favicon/, /^\/api$/];

function shouldSkipLogging(path: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(path));
}

export function createAuditLoggerMiddleware(auditLogService: AuditLogService) {
  return (req: IRequestWithUser, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const endpoint = req.originalUrl || req.path;

    if (shouldSkipLogging(endpoint)) {
      next();
      return;
    }

    res.on('finish', () => {
      const responseTimeMs = Date.now() - startTime;
      const statusCode = res.statusCode;
      const userAction = resolveUserAction(req.method, endpoint);

      const severity =
        statusCode >= 500
          ? AuditSeverity.ERROR
          : statusCode >= 400
            ? AuditSeverity.WARNING
            : AuditSeverity.INFO;

      void auditLogService
        .log({
          userId: req.user?.id,
          userEmail: req.user?.email,
          action: userAction.action,
          category: userAction.category,
          severity,
          description: userAction.description,
          apiEndpoint: endpoint,
          httpMethod: req.method,
          statusCode,
          responseTimeMs,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || 'unknown',
          requestId: req.requestId,
          metadata: {
            path: req.path,
            baseUrl: req.baseUrl,
            queryKeys: Object.keys(req.query || {}),
          },
        })
        .catch((error: unknown) => {
          logger.error('Failed to write audit log from middleware', error as Error);
        });
    });

    next();
  };
}
