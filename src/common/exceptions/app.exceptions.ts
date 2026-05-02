import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when a requested resource cannot be found.
 * Maps to HTTP 404 Not Found.
 */
export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, id?: string | number) {
    const message = id ? `${resource} with id '${id}' was not found` : `${resource} was not found`;
    super({ message, error: 'Not Found', statusCode: HttpStatus.NOT_FOUND }, HttpStatus.NOT_FOUND);
  }
}

/**
 * Thrown when an operation is not permitted for the current user/state.
 * Maps to HTTP 403 Forbidden.
 */
export class ForbiddenOperationException extends HttpException {
  constructor(message = 'You do not have permission to perform this action') {
    super({ message, error: 'Forbidden', statusCode: HttpStatus.FORBIDDEN }, HttpStatus.FORBIDDEN);
  }
}

/**
 * Thrown when a resource already exists (e.g. duplicate email).
 * Maps to HTTP 409 Conflict.
 */
export class ResourceConflictException extends HttpException {
  constructor(resource: string, field?: string) {
    const message = field
      ? `${resource} with this ${field} already exists`
      : `${resource} already exists`;
    super({ message, error: 'Conflict', statusCode: HttpStatus.CONFLICT }, HttpStatus.CONFLICT);
  }
}

/**
 * Thrown when input data fails business-rule validation (beyond DTO constraints).
 * Maps to HTTP 422 Unprocessable Entity.
 */
export class BusinessValidationException extends HttpException {
  constructor(message: string) {
    super(
      { message, error: 'Unprocessable Entity', statusCode: HttpStatus.UNPROCESSABLE_ENTITY },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * Thrown when an external service or dependency is unavailable.
 * Maps to HTTP 503 Service Unavailable.
 */
export class ServiceUnavailableException extends HttpException {
  constructor(service: string) {
    const message = `${service} is currently unavailable. Please try again later.`;
    super(
      { message, error: 'Service Unavailable', statusCode: HttpStatus.SERVICE_UNAVAILABLE },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
