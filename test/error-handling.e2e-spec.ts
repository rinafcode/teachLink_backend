import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Get,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from '../src/common/interceptors/global-exception.filter';
import { ErrorCode } from '../src/common/exceptions/error-codes';
import {
  ResourceNotFoundException,
  ForbiddenOperationException,
  ResourceConflictException,
  BusinessValidationException,
  ServiceUnavailableException,
  InvalidCredentialsException,
  InvalidTokenException,
  RateLimitExceededException,
} from '../src/common/exceptions/app.exceptions';
import supertest from 'supertest';

@Controller('error-test')
class ErrorTestController {
  @Get('400')
  throw400() {
    throw new BadRequestException('Validation failed');
  }

  @Get('401-credentials')
  throw401Credentials() {
    throw new InvalidCredentialsException('Invalid login');
  }

  @Get('401-token')
  throw401Token() {
    throw new InvalidTokenException('Token expired');
  }

  @Get('401-builtin')
  throw401Builtin() {
    throw new UnauthorizedException('Auth context missing');
  }

  @Get('403')
  throw403() {
    throw new ForbiddenOperationException('Permission denied');
  }

  @Get('404')
  throw404() {
    throw new ResourceNotFoundException('User', '123');
  }

  @Get('409')
  throw409() {
    throw new ResourceConflictException('User', 'email');
  }

  @Get('422')
  throw422() {
    throw new BusinessValidationException('Business rule violation');
  }

  @Get('429')
  throw429() {
    throw new RateLimitExceededException(30);
  }

  @Get('503')
  throw503() {
    throw new ServiceUnavailableException('BillingService');
  }

  @Get('500')
  throw500() {
    throw new Error('Unhandled database crash');
  }
}

describe('Error Handling (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ErrorTestController],
      providers: [
        {
          provide: APP_FILTER,
          useClass: GlobalExceptionFilter,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const assertErrorResponse = (
    response: any,
    expectedStatus: number,
    expectedCode: string,
    expectedMessage: string,
  ) => {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('statusCode', expectedStatus);
    expect(response.body.error).toHaveProperty('code', expectedCode);
    expect(response.body.error).toHaveProperty('message');
    expect(response.body.error.message).toContain(expectedMessage);
    expect(response.body.error).toHaveProperty('timestamp');
    expect(response.body.error).toHaveProperty('requestId');
  };

  it('VAL_001 / 400 Bad Request', async () => {
    const res = await supertest(app.getHttpServer()).get('/error-test/400');
    assertErrorResponse(res, 400, ErrorCode.VALIDATION_ERROR, 'Validation failed');
  });

  it('AUTH_001 / 401 Invalid Credentials', async () => {
    const res = await supertest(app.getHttpServer()).get('/error-test/401-credentials');
    assertErrorResponse(res, 401, ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid login');
  });

  it('AUTH_002 / 401 Invalid Token', async () => {
    const res = await supertest(app.getHttpServer()).get('/error-test/401-token');
    assertErrorResponse(res, 401, ErrorCode.AUTH_INVALID_TOKEN, 'Token expired');
  });

  it('AUTH_004 / 401 Unauthorized Built-in', async () => {
    const res = await supertest(app.getHttpServer()).get('/error-test/401-builtin');
    assertErrorResponse(res, 401, ErrorCode.AUTH_UNAUTHORIZED, 'Auth context missing');
  });

  it('AUTH_003 / 403 Forbidden Operation', async () => {
    const res = await supertest(app.getHttpServer()).get('/error-test/403');
    assertErrorResponse(res, 403, ErrorCode.AUTH_FORBIDDEN, 'Permission denied');
  });

  it('RES_001 / 404 Resource Not Found', async () => {
    const res = await supertest(app.getHttpServer()).get('/error-test/404');
    assertErrorResponse(res, 404, ErrorCode.RESOURCE_NOT_FOUND, "User with id '123' was not found");
  });

  it('RES_002 / 409 Resource Conflict', async () => {
    const res = await supertest(app.getHttpServer()).get('/error-test/409');
    assertErrorResponse(
      res,
      409,
      ErrorCode.RESOURCE_CONFLICT,
      'User with this email already exists',
    );
  });

  it('BUS_001 / 422 Business Validation Exception', async () => {
    const res = await supertest(app.getHttpServer()).get('/error-test/422');
    assertErrorResponse(res, 422, ErrorCode.BUSINESS_RULE_VIOLATION, 'Business rule violation');
  });

  it('SYS_003 / 429 Rate Limit Exceeded', async () => {
    const res = await supertest(app.getHttpServer()).get('/error-test/429');
    assertErrorResponse(res, 429, ErrorCode.RATE_LIMIT_EXCEEDED, 'exceeded the request rate limit');
  });

  it('SYS_002 / 503 Service Unavailable', async () => {
    const res = await supertest(app.getHttpServer()).get('/error-test/503');
    assertErrorResponse(
      res,
      503,
      ErrorCode.SERVICE_UNAVAILABLE,
      'BillingService is currently unavailable',
    );
  });

  it('SYS_001 / 500 Unhandled Error', async () => {
    const res = await supertest(app.getHttpServer()).get('/error-test/500');
    assertErrorResponse(res, 500, ErrorCode.INTERNAL_SERVER_ERROR, 'Unhandled database crash');
  });
});
