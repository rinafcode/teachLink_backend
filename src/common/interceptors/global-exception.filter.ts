import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MulterError } from 'multer';
import { QueryFailedError, EntityNotFoundError, OptimisticLockVersionMismatchError } from 'typeorm';
import { IApiError, IValidationErrorDetail } from '../../interfaces/api-error.interface';
import { CORRELATION_ID_HEADER, getCorrelationId } from '../utils/correlation.utils';

/**
 * Provides global Exception Filter behavior.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  /**
   * Executes catch.
   * @param exception The exception.
   * @param host The host.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error, details, stack } = this.resolveException(exception);

    const correlationId = getCorrelationId();

    const errorResponse: IApiError = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId,
      ...(details?.length && { details }),
      ...(!this.isProduction && stack && { stack }),
    };

    if (correlationId) {
      response.setHeader(CORRELATION_ID_HEADER, correlationId);
    }

    this.logger.error(
      `[${request.method}] ${request.url} → ${statusCode} ${error}: ${
        Array.isArray(message) ? message.join(', ') : message
      }`,
      !this.isProduction ? stack : undefined,
      GlobalExceptionFilter.name,
    );

    response.status(statusCode).json(errorResponse);
  }

  // ─── Resolution helpers ────────────────────────────────────────────────────

  private resolveException(exception: unknown): {
    statusCode: number;
    message: string | string[];
    error: string;
    details?: IValidationErrorDetail[];
    stack?: string;
  } {
    // 1. NestJS HttpException (includes class-validator BadRequestException)
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    // 2. TypeORM – query/constraint failures
    if (exception instanceof QueryFailedError) {
      return this.fromQueryFailedError(exception);
    }

    // 3. Multer upload failures
    if (exception instanceof MulterError) {
      return this.fromMulterError(exception);
    }

    // 4. TypeORM – entity not found
    if (exception instanceof EntityNotFoundError) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'The requested resource was not found.',
        error: 'Not Found',
        stack: (exception as Error).stack,
      };
    }

    // 4b. TypeORM - Optimistic Locking Conflict
    if (exception instanceof OptimisticLockVersionMismatchError) {
      return {
        statusCode: HttpStatus.CONFLICT,
        message: 'The resource was modified by another request. Please refresh and try again.',
        error: 'Conflict',
        stack: (exception as Error).stack,
      };
    }

    // 5. Generic / unexpected Error
    if (exception instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: this.isProduction
          ? 'An unexpected error occurred. Please try again later.'
          : exception.message,
        error: 'Internal Server Error',
        stack: exception.stack,
      };
    }

    // 6. Non-Error throw (strings, objects, etc.)
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred.',
      error: 'Internal Server Error',
    };
  }

  private fromHttpException(exception: HttpException): {
    statusCode: number;
    message: string | string[];
    error: string;
    details?: IValidationErrorDetail[];
    stack?: string;
  } {
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const stack = exception.stack;

    // class-validator wraps errors as { message: string[], error: string }
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const res = exceptionResponse as Record<string, unknown>;

      const rawMessages = res['message'];
      const messages: string[] = Array.isArray(rawMessages)
        ? (rawMessages as string[])
        : typeof rawMessages === 'string'
          ? [rawMessages]
          : [exception.message];

      // Parse class-validator constraint objects when present
      const details = this.extractValidationDetails(rawMessages);

      return {
        statusCode,
        message: messages.length === 1 ? messages[0] : messages,
        error: (res['error'] as string) ?? exception.message,
        ...(details.length && { details }),
        stack,
      };
    }

    return {
      statusCode,
      message: typeof exceptionResponse === 'string' ? exceptionResponse : exception.message,
      error: exception.message,
      stack,
    };
  }

  private fromQueryFailedError(exception: QueryFailedError): {
    statusCode: number;
    message: string;
    error: string;
    stack?: string;
  } {
    const driverError = (exception as QueryFailedError & { code?: string }).code;

    // PostgreSQL unique-violation
    if (driverError === '23505') {
      return {
        statusCode: HttpStatus.CONFLICT,
        message: 'A record with the provided value already exists.',
        error: 'Conflict',
        stack: exception.stack,
      };
    }

    // PostgreSQL foreign-key violation
    if (driverError === '23503') {
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'Referenced resource does not exist.',
        error: 'Unprocessable Entity',
        stack: exception.stack,
      };
    }

    // Generic DB error – never expose query details in production
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.isProduction ? 'A database error occurred.' : exception.message,
      error: 'Database Error',
      stack: exception.stack,
    };
  }

  private fromMulterError(exception: MulterError): {
    statusCode: number;
    message: string;
    error: string;
    stack?: string;
  } {
    switch (exception.code) {
      case 'LIMIT_FILE_SIZE':
        return {
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          message: 'Uploaded file exceeds the maximum allowed size.',
          error: 'Payload Too Large',
          stack: exception.stack,
        };
      case 'LIMIT_FILE_COUNT':
      case 'LIMIT_PART_COUNT':
      case 'LIMIT_FIELD_COUNT':
      case 'LIMIT_FIELD_KEY':
      case 'LIMIT_FIELD_VALUE':
      case 'LIMIT_UNEXPECTED_FILE':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: exception.message,
          error: 'Bad Request',
          stack: exception.stack,
        };
      default:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Upload validation failed.',
          error: 'Bad Request',
          stack: exception.stack,
        };
    }
  }

  /**
   * Converts class-validator nested error objects into structured details when
   * the raw message array contains constraint objects rather than plain strings.
   */
  private extractValidationDetails(raw: unknown): IValidationErrorDetail[] {
    if (!Array.isArray(raw)) return [];

    return raw.reduce<IValidationErrorDetail[]>((acc, item) => {
      if (
        typeof item === 'object' &&
        item !== null &&
        'property' in item &&
        'constraints' in item
      ) {
        acc.push({
          property: (item as { property: string }).property,
          constraints: (item as { constraints: Record<string, string> }).constraints,
        });
      }
      return acc;
    }, []);
  }
}
