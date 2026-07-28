import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { ErrorCode } from '../exceptions/error-codes';
import {
  ResourceNotFoundException,
  ForbiddenOperationException,
} from '../exceptions/app.exceptions';

jest.mock('../utils/correlation.utils', () => ({
  getCorrelationId: () => 'test-correlation-id',
}));

function buildMockHost(overrides: { url?: string; method?: string; requestId?: string } = {}) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = {
    url: overrides.url ?? '/test',
    method: overrides.method ?? 'GET',
    requestId: overrides.requestId ?? 'test-request-id',
  };

  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
    json,
    status,
    response,
  };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('maps HttpException to its status and message', () => {
    const mock = buildMockHost();
    filter.catch(new HttpException('bad request', HttpStatus.BAD_REQUEST), mock as any);

    expect(mock.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mock.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'bad request',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      },
    });
  });

  it('maps unknown errors to 500', () => {
    const mock = buildMockHost();
    filter.catch(new Error('db crashed'), mock as any);

    expect(mock.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mock.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'db crashed',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      },
    });
  });

  it('maps ResourceNotFoundException to 404', () => {
    const mock = buildMockHost();
    filter.catch(new ResourceNotFoundException('Course', 'abc'), mock as any);

    expect(mock.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mock.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.RESOURCE_NOT_FOUND,
        statusCode: HttpStatus.NOT_FOUND,
        message: "Course with id 'abc' was not found",
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      },
    });
  });

  it('maps ForbiddenOperationException to 403', () => {
    const mock = buildMockHost();
    filter.catch(new ForbiddenOperationException('Only owners may delete'), mock as any);

    expect(mock.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mock.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.AUTH_FORBIDDEN,
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Only owners may delete',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      },
    });
  });

  it('includes path and timestamp in every response', () => {
    const mock = buildMockHost({ url: '/api/courses/1' });
    filter.catch(new HttpException('not found', 404), mock as any);

    const call = mock.json.mock.calls[0][0];
    expect(call.success).toBe(false);
    expect(call.error.timestamp).toBeDefined();
    expect(call.error.requestId).toBe('test-request-id');
  });

  it('handles non-Error thrown objects', () => {
    const mock = buildMockHost();
    filter.catch('a plain string error', mock as any);

    expect(mock.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mock.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      },
    });
  });
});
