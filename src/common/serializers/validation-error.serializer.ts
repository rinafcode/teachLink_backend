import { BadRequestException } from '@nestjs/common';
import type { StandardValidationError } from '../pipes/validation.pipe';

export function serializeValidationError(exception: BadRequestException): StandardValidationError {
  const response = exception.getResponse();

  // Already in our standard shape
  if (
    typeof response === 'object' &&
    response !== null &&
    'details' in response
  ) {
    return response as StandardValidationError;
  }

  // NestJS default shape: { message: string[] | string, error: string, statusCode: number }
  const fallback = response as { message?: string | string[]; error?: string; statusCode?: number };
  const messages = Array.isArray(fallback.message) ? fallback.message : [fallback.message ?? 'Bad Request'];

  return {
    statusCode: 400,
    error: fallback.error ?? 'Bad Request',
    message: 'Input validation failed',
    details: messages.map((msg) => ({ field: 'unknown', messages: [msg] })),
  };
}