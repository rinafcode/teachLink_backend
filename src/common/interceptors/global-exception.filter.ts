import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';
import { ApiError, ValidationErrorDetail } from '../interfaces/api-error.interface';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error, details, stack } =
      this.resolveException(exception);

    const errorResponse: ApiError = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(details?.length && { details }),
      ...(!this.isProduction && stack && { stack }),
    };

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
    details?: ValidationErrorDetail[];
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

    // 3. TypeORM – entity not found
    if (exception instanceof EntityNotFoundError) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'The requested resource was not found.',
        error: 'Not Found',
        stack: (exception as Error).stack,
      };
    }

    // 4. Generic / unexpected Error
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

    // 5. Non-Error throw (strings, objects, etc.)
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
    details?: ValidationErrorDetail[];
    stack?: string;
  } {
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const stack = exception.stack;

    // class-validator wraps errors as { message: string[], error: string }
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
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
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : exception.message,
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
    const driverError = (exception as QueryFailedError & { code?: string })
      .code;

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
      message: this.isProduction
        ? 'A database error occurred.'
        : exception.message,
      error: 'Database Error',
      stack: exception.stack,
    };
  }

  /**
   * Converts class-validator nested error objects into structured details when
   * the raw message array contains constraint objects rather than plain strings.
   */
  private extractValidationDetails(
    raw: unknown,
  ): ValidationErrorDetail[] {
    if (!Array.isArray(raw)) return [];

    return raw.reduce<ValidationErrorDetail[]>((acc, item) => {
      if (
        typeof item === 'object' &&
        item !== null &&
        'property' in item &&
        'constraints' in item
      ) {
        acc.push({
          field: (item as { property: string }).property,
          constraints: (item as { constraints: Record<string, string> })
            .constraints,
        });
      }
      return acc;
    }, []);
  }
}