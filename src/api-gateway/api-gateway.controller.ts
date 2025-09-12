import { Controller, All, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { RoutingService } from './routing/routing.service';
import { GatewayAuthService } from './auth/gateway-auth.service';
import { TransformService } from './transformation/transform.service';
import { GatewayMonitoringService } from './monitoring/gateway-monitoring.service';
import { PolicyEnforcementService } from './policies/policy-enforcement.service';

@Controller('gateway')
export class APIGatewayController {
  constructor(
    private readonly routingService: RoutingService,
    private readonly authService: GatewayAuthService,
    private readonly transformService: TransformService,
    private readonly monitoringService: GatewayMonitoringService,
    private readonly policyService: PolicyEnforcementService,
  ) {}

  @All('*')
  async proxy(@Req() req: Request, @Res() res: Response) {
    try {
      // 1. Authenticate
      const isAuthenticated = await this.authService.authenticate(req);
      if (!isAuthenticated) {
        this.monitoringService.logError(req, {
          message: 'Unauthorized',
          status: HttpStatus.UNAUTHORIZED,
        });
        return res
          .status(HttpStatus.UNAUTHORIZED)
          .json({ error: 'Unauthorized' });
      }

      // 2. Enforce policies (rate limiting, endpoint access, etc.)
      const allowed = await this.policyService.enforcePolicies(req);
      if (!allowed) {
        this.monitoringService.logError(req, {
          message: 'Rate limit exceeded',
          status: 429,
        });
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }

      // 3. Transform request
      const transformedRequest = this.transformService.transformRequest(req);

      // 4. Route request (simulate forwarding)
      const routeResult =
        await this.routingService.routeRequest(transformedRequest);

      // 5. Simulate microservice response
      const response = {
        status: routeResult.status || HttpStatus.OK,
        data: {
          message: `Proxied to ${routeResult.service || 'service'} at ${routeResult.endpoint || 'endpoint'}`,
          method: routeResult.method || req.method,
          body: routeResult.body,
        },
        headers: routeResult.headers || {},
      };

      // 6. Transform response
      const transformedResponse =
        this.transformService.transformResponse(response);

      // 7. Monitoring
      this.monitoringService.logRequest(req);
      this.monitoringService.logResponse(req, response);

      // Set response headers if any
      if (transformedResponse.headers) {
        Object.entries(transformedResponse.headers).forEach(([key, value]) => {
          res.setHeader(key, value as string);
        });
      }

      return res.status(response.status).json(transformedResponse);
    } catch (error) {
      this.monitoringService.logError(req, error);
      return res.status(error.status || 500).json({ error: error.message });
    }
  }
}
