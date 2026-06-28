import { ValidationPipe, ValidationError, BadRequestException } from '@nestjs/common';

export interface ValidationErrorItem {
  field: string;
  messages: string[];
  children?: ValidationErrorItem[];
}

export interface StandardValidationError {
  statusCode: number;
  error: string;
  message: string;
  details: ValidationErrorItem[];
}

function flattenErrors(errors: ValidationError[], parentField = ''): ValidationErrorItem[] {
  return errors.map((error) => {
    const field = parentField ? `${parentField}.${error.property}` : error.property;
    const messages = Object.values(error.constraints ?? {});
    const children = error.children?.length
      ? flattenErrors(error.children, field)
      : undefined;
    return { field, messages, ...(children ? { children } : {}) };
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,            // strip unknown properties
    forbidNonWhitelisted: true, // 400 on unknown properties
    transform: true,            // auto-transform payloads to DTO instances
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory(errors: ValidationError[]) {
      const details = flattenErrors(errors);
      const payload: StandardValidationError = {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Input validation failed',
        details,
      };
      return new BadRequestException(payload);
    },
  });
}