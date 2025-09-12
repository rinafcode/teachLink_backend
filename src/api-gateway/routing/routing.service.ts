import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ServiceDiscoveryService } from '../../messaging/services/service-discovery.service';
import axios, { AxiosRequestHeaders } from 'axios';

@Injectable()
export class RoutingService {
  constructor(
    private readonly serviceDiscoveryService: ServiceDiscoveryService,
  ) {}

  /**
   * Routes the request to the appropriate microservice using service discovery and load balancing.
   * Proxies the HTTP request and returns the response.
   */
  async routeRequest(request: any): Promise<any> {
    // Extract service name from request path, e.g., /gateway/serviceName/...
    const pathParts = request.path.split('/').filter(Boolean);
    const serviceName = pathParts[1]; // e.g., /gateway/users/123 -> 'users'
    if (!serviceName) {
      throw new HttpException(
        'Service name not specified in path',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Discover healthy service instance
    const service = await this.serviceDiscoveryService.loadBalance(
      serviceName,
      'round-robin',
    );
    if (!service) {
      throw new HttpException(
        'No healthy service found',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Construct target URL
    const targetUrl = `http://${service.host}:${service.port}${request.originalUrl.replace('/gateway', '')}`;

    // Prepare headers (remove hop-by-hop headers)
    const headers: AxiosRequestHeaders = { ...request.headers };
    delete headers['host'];
    delete headers['connection'];
    delete headers['content-length'];
    delete headers['accept-encoding'];
    delete headers['x-forwarded-for'];
    headers['x-gateway-proxied'] = 'true';

    try {
      const axiosResponse = await axios.request({
        url: targetUrl,
        method: request.method,
        headers,
        data: request.body,
        validateStatus: () => true,
        responseType: 'json',
      });
      return {
        status: axiosResponse.status,
        body: axiosResponse.data,
        headers: axiosResponse.headers,
      };
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Proxy error',
        error.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
