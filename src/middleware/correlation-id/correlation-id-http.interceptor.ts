import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { injectCorrelationIdToHeaders } from '../../common/utils/correlation.utils';

/**
 * Attaches the active correlation ID to every outbound axios request
 * made through the injected HttpService instance.
 */
@Injectable()
export class CorrelationIdHttpInterceptor implements OnModuleInit {
  constructor(private readonly httpService: HttpService) {}

  onModuleInit(): void {
    this.httpService.axiosRef.interceptors.request.use((config) => {
      config.headers = injectCorrelationIdToHeaders(
        (config.headers ?? {}) as Record<string, unknown>,
      ) as typeof config.headers;
      return config;
    });
  }
}
