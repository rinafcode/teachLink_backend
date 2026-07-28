import { HttpStatus } from '@nestjs/common';
import {
  ResourceNotFoundException,
  ForbiddenOperationException,
  ResourceConflictException,
  BusinessValidationException,
  ServiceUnavailableException,
  InvalidCredentialsException,
  InvalidTokenException,
  RateLimitExceededException,
} from './app.exceptions';

describe('Custom Exceptions', () => {
  describe('ResourceNotFoundException', () => {
    it('returns 404 with resource name only', () => {
      const ex = new ResourceNotFoundException('Course');
      expect(ex.getStatus()).toBe(HttpStatus.NOT_FOUND);
      const body = ex.getResponse() as any;
      expect(body.message).toBe('Course was not found');
      expect(body.error).toBe('Not Found');
      expect(body.statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it('returns 404 with resource name and id', () => {
      const ex = new ResourceNotFoundException('Course', 'abc-123');
      const body = ex.getResponse() as any;
      expect(body.message).toBe("Course with id 'abc-123' was not found");
    });

    it('accepts numeric id', () => {
      const ex = new ResourceNotFoundException('User', 42);
      const body = ex.getResponse() as any;
      expect(body.message).toBe("User with id '42' was not found");
    });
  });

  describe('ForbiddenOperationException', () => {
    it('returns 403 with default message', () => {
      const ex = new ForbiddenOperationException();
      expect(ex.getStatus()).toBe(HttpStatus.FORBIDDEN);
      const body = ex.getResponse() as any;
      expect(body.message).toBe('You do not have permission to perform this action');
      expect(body.error).toBe('Forbidden');
    });

    it('accepts a custom message', () => {
      const ex = new ForbiddenOperationException('Only the owner may do this');
      const body = ex.getResponse() as any;
      expect(body.message).toBe('Only the owner may do this');
    });
  });

  describe('ResourceConflictException', () => {
    it('returns 409 without field', () => {
      const ex = new ResourceConflictException('Tenant');
      expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
      const body = ex.getResponse() as any;
      expect(body.message).toBe('Tenant already exists');
      expect(body.error).toBe('Conflict');
    });

    it('returns 409 with field', () => {
      const ex = new ResourceConflictException('User', 'email');
      const body = ex.getResponse() as any;
      expect(body.message).toBe('User with this email already exists');
    });
  });

  describe('BusinessValidationException', () => {
    it('returns 422 with message', () => {
      const ex = new BusinessValidationException('Workflow must be inactive before editing');
      expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      const body = ex.getResponse() as any;
      expect(body.message).toBe('Workflow must be inactive before editing');
      expect(body.error).toBe('Unprocessable Entity');
    });
  });

  describe('ServiceUnavailableException', () => {
    it('returns 503 with service name', () => {
      const ex = new ServiceUnavailableException('PaymentService');
      expect(ex.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      const body = ex.getResponse() as any;
      expect(body.message).toContain('PaymentService');
      expect(body.error).toBe('Service Unavailable');
    });
  });

  describe('InvalidCredentialsException', () => {
    it('returns 401 with default message', () => {
      const ex = new InvalidCredentialsException();
      expect(ex.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      const body = ex.getResponse() as any;
      expect(body.message).toBe('Invalid credentials');
      expect(body.error).toBe('Unauthorized');
    });

    it('accepts a custom message', () => {
      const ex = new InvalidCredentialsException('User not found');
      const body = ex.getResponse() as any;
      expect(body.message).toBe('User not found');
    });
  });

  describe('InvalidTokenException', () => {
    it('returns 401 with default message', () => {
      const ex = new InvalidTokenException();
      expect(ex.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      const body = ex.getResponse() as any;
      expect(body.message).toBe('Invalid or expired token');
      expect(body.error).toBe('Unauthorized');
    });

    it('accepts a custom message', () => {
      const ex = new InvalidTokenException('Token has expired');
      const body = ex.getResponse() as any;
      expect(body.message).toBe('Token has expired');
    });
  });

  describe('RateLimitExceededException', () => {
    it('returns 429 without retry info', () => {
      const ex = new RateLimitExceededException();
      expect(ex.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const body = ex.getResponse() as any;
      expect(body.message).toContain('rate limit');
      expect(body.error).toBe('Too Many Requests');
      expect(body.retryAfterSeconds).toBeUndefined();
    });

    it('includes retryAfterSeconds when provided', () => {
      const ex = new RateLimitExceededException(60);
      const body = ex.getResponse() as any;
      expect(body.retryAfterSeconds).toBe(60);
    });
  });
});
