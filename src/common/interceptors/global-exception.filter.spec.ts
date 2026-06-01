import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import {
  ResourceNotFoundException,
  ForbiddenOperationException,
} from '../exceptions/app.exceptions';

jest.mock('../utils/correlation.utils', () => ({
  getCorrelationId: () => 'test-correlation-id',
}));

function buildMockHost(overrides: { url?: string; method?: string } = {}) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { url: overrides.url ?? '/test', method: overrides.method ?? 'GET' };

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
    expect(mock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        correlationId: 'test-correlation-id',
      }),
    );
  });

  it('maps unknown errors to 500', () => {
    const mock = buildMockHost();
    filter.catch(new Error('db crashed'), mock as any);

    expect(mock.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'db crashed',
      }),
    );
  });

  it('maps ResourceNotFoundException to 404', () => {
    const mock = buildMockHost();
    filter.catch(new ResourceNotFoundException('Course', 'abc'), mock as any);

    expect(mock.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: "Course with id 'abc' was not found",
      }),
    );
  });

  it('maps ForbiddenOperationException to 403', () => {
    const mock = buildMockHost();
    filter.catch(new ForbiddenOperationException('Only owners may delete'), mock as any);

    expect(mock.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Only owners may delete',
      }),
    );
  });

  it('includes path and timestamp in every response', () => {
    const mock = buildMockHost({ url: '/api/courses/1' });
    filter.catch(new HttpException('not found', 404), mock as any);

    const call = mock.json.mock.calls[0][0];
    expect(call.path).toBe('/api/courses/1');
    expect(call.timestamp).toBeDefined();
  });

  it('handles non-Error thrown objects', () => {
    const mock = buildMockHost();
    filter.catch('a plain string error', mock as any);

    expect(mock.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mock.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });
});
