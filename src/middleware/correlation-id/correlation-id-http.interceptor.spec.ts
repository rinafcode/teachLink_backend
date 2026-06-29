import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationIdHttpInterceptor } from './correlation-id-http.interceptor';
import {
  CORRELATION_ID_HEADER,
  runWithCorrelationId,
  X_CORRELATION_ID_HEADER,
} from '../../common/utils/correlation.utils';

describe('CorrelationIdHttpInterceptor', () => {
  let interceptor: CorrelationIdHttpInterceptor;
  let requestUse: jest.Mock;

  beforeEach(async () => {
    requestUse = jest.fn().mockReturnValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrelationIdHttpInterceptor,
        {
          provide: HttpService,
          useValue: {
            axiosRef: {
              interceptors: {
                request: {
                  use: requestUse,
                },
              },
            },
          },
        },
      ],
    }).compile();

    interceptor = module.get(CorrelationIdHttpInterceptor);
    interceptor.onModuleInit();
  });

  it('registers an axios request interceptor', () => {
    expect(requestUse).toHaveBeenCalledTimes(1);
  });

  it('injects correlation headers into outbound axios config', () => {
    const handler = requestUse.mock.calls[0][0] as (config: {
      headers: Record<string, string>;
    }) => { headers: Record<string, string> };

    let updated: { headers: Record<string, string> } = { headers: {} };
    runWithCorrelationId(() => {
      updated = handler({ headers: { Authorization: 'Bearer token' } });
    }, 'outbound-id');

    expect(updated.headers[X_CORRELATION_ID_HEADER]).toBe('outbound-id');
    expect(updated.headers[CORRELATION_ID_HEADER]).toBe('outbound-id');
    expect(updated.headers.Authorization).toBe('Bearer token');
  });
});
