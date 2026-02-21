import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { ServiceDiscoveryService } from '../discovery/service-discovery.service';

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
    const service = await this.discovery.getService(serviceName);
    const url = `${service.baseUrl}${path}`;

    try {
      const response: AxiosResponse<T> = await firstValueFrom(
        this.httpService.request<T>({
          url,
          method,
          data,
          timeout: 5000,
        }),
      );

      return response.data;
    } catch (error) {
      await this.discovery.markUnhealthy(serviceName);
      throw error;
    }
  }
}