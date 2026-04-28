import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse, Method } from 'axios';
import { ServiceDiscoveryService } from '../discovery/service-discovery.service';
import {
  injectCorrelationIdToHeaders,
  getCorrelationId,
} from '../../common/utils/correlation.utils';

@Injectable()
export class ServiceMeshService {
  constructor(
    private readonly discovery: ServiceDiscoveryService,
    private readonly httpService: HttpService,
  ) {}

  async request<T = any>(
    serviceName: string,
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    data?: any,
  ): Promise<T> {
    const service = await this.discovery.resolveService(serviceName, path);
    return this.dispatchRequest<T>(service.name, service.id, service.baseUrl, service.boundary.domain, path, method, data);
  }

  async requestByRoute<T = any>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    data?: any,
  ): Promise<T> {
    const service = await this.discovery.discoverByRoute(path);
    return this.dispatchRequest<T>(service.name, service.id, service.baseUrl, service.boundary.domain, path, method, data);
  }

  private async dispatchRequest<T>(
    serviceName: string,
    serviceId: string,
    baseUrl: string,
    serviceDomain: string,
    path: string,
    method: Method,
    data?: any,
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const correlationId = getCorrelationId();

    try {
      const response: AxiosResponse<T> = await firstValueFrom(
        this.httpService.request<T>({
          url,
          method,
          data,
          timeout: 5000,
          headers: {
            ...injectCorrelationIdToHeaders(undefined, correlationId),
            'x-service-name': serviceName,
            'x-service-domain': serviceDomain,
          },
        }),
      );

      return response.data;
    } catch (error) {
      await this.discovery.markUnhealthy(serviceName, serviceId);
      throw error;
    }
  }
}
