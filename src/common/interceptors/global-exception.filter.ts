import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getCorrelationId } from '../utils/correlation.utils';
import { ErrorCode } from '../exceptions/error-codes';
import {
  ResourceNotFoundException,
  ForbiddenOperationException,
  ResourceConflictException,
  BusinessValidationException,
  ServiceUnavailableException,
  InvalidCredentialsException,
  InvalidTokenException,
  RateLimitExceededException,
} from '../exceptions/app.exceptions';

export function getErrorCode(exception: unknown): ErrorCode {
  if (exception instanceof InvalidCredentialsException) {
    return ErrorCode.AUTH_INVALID_CREDENTIALS;
  }
  if (exception instanceof InvalidTokenException) {
    return ErrorCode.AUTH_INVALID_TOKEN;
  }
  if (exception instanceof ForbiddenOperationException) {
    return ErrorCode.AUTH_FORBIDDEN;
  }
  if (exception instanceof UnauthorizedException) {
    return ErrorCode.AUTH_UNAUTHORIZED;
  }
  if (exception instanceof ResourceNotFoundException) {
    return ErrorCode.RESOURCE_NOT_FOUND;
  }
  if (exception instanceof ResourceConflictException) {
    return ErrorCode.RESOURCE_CONFLICT;
  }
  if (exception instanceof BadRequestException) {
    return ErrorCode.VALIDATION_ERROR;
  }
  if (exception instanceof BusinessValidationException) {
    return ErrorCode.BUSINESS_RULE_VIOLATION;
  }
  if (exception instanceof RateLimitExceededException) {
    return ErrorCode.RATE_LIMIT_EXCEEDED;
  }
  if (exception instanceof ServiceUnavailableException) {
    return ErrorCode.SERVICE_UNAVAILABLE;
  }

  const constructorName = exception?.constructor?.name;
  if (constructorName === 'InvalidCredentialsException') return ErrorCode.AUTH_INVALID_CREDENTIALS;
  if (constructorName === 'InvalidTokenException') return ErrorCode.AUTH_INVALID_TOKEN;
  if (constructorName === 'ForbiddenOperationException') return ErrorCode.AUTH_FORBIDDEN;
  if (constructorName === 'UnauthorizedException') return ErrorCode.AUTH_UNAUTHORIZED;
  if (constructorName === 'ResourceNotFoundException') return ErrorCode.RESOURCE_NOT_FOUND;
  if (constructorName === 'ResourceConflictException') return ErrorCode.RESOURCE_CONFLICT;
  if (constructorName === 'BadRequestException') return ErrorCode.VALIDATION_ERROR;
  if (constructorName === 'BusinessValidationException') return ErrorCode.BUSINESS_RULE_VIOLATION;
  if (constructorName === 'RateLimitExceededException') return ErrorCode.RATE_LIMIT_EXCEEDED;
  if (constructorName === 'ServiceUnavailableException') return ErrorCode.SERVICE_UNAVAILABLE;

  return ErrorCode.INTERNAL_SERVER_ERROR;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : undefined;

    const rawMessage =
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
        ? (exceptionResponse as { message: string | string[] }).message
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
    const errorCode = getErrorCode(exception);
    const requestId = (request as any).requestId || getCorrelationId() || 'unknown';

    if (!isHttpException) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url} [Request ID: ${requestId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status >= 500) {
      this.logger.error(
        `Server error ${status} on ${request.method} ${request.url} [Request ID: ${requestId}]`,
        exception.stack,
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code: errorCode,
        message,
        statusCode: status,
        timestamp: new Date().toISOString(),
        requestId,
      },
    });
  }
}
