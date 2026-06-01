import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { RouteConfig, ProxyResponse } from '../interfaces/gateway.interfaces';

@Injectable()
export class GatewayRoutingService {
  private readonly logger = new Logger(GatewayRoutingService.name);

  private readonly routes = new Map<string, RouteConfig>([
    [
      'courses',
      { service: 'courses', upstream: 'http://localhost:3000', weight: 1, cacheTtlSeconds: 60, rateLimitPerMinute: 100 },
    ],
    [
      'users',
      { service: 'users', upstream: 'http://localhost:3000', weight: 1, cacheTtlSeconds: 30, rateLimitPerMinute: 200 },
    ],
    [
      'analytics',
      { service: 'analytics', upstream: 'http://localhost:3000', weight: 1, cacheTtlSeconds: 120, rateLimitPerMinute: 50 },
    ],
  ]);

  constructor(private readonly http: HttpService) {}

  getRoute(service: string): RouteConfig {
    const route = this.routes.get(service);
    if (!route) throw new NotFoundException(`No route configured for service: ${service}`);
    return route;
  }

  registerRoute(config: RouteConfig): void {
    this.routes.set(config.service, config);
    this.logger.log(`Route registered: ${config.service} -> ${config.upstream}`);
  }

  async proxy<T>(
    service: string,
    path: string,
    method: string,
    headers: Record<string, string>,
    body?: unknown,
  ): Promise<ProxyResponse<T>> {
    const route = this.getRoute(service);
    const url = `${route.upstream}${path}`;

    this.logger.debug(`Proxying ${method} ${url}`);

    const response = await firstValueFrom(
      this.http.request<T>({ method, url, headers, data: body }),
    );

    return {
      status: response.status,
      data: response.data,
      headers: response.headers as Record<string, string>,
      cached: false,
    };
  }
}
