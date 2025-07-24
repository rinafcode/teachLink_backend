import { Test, TestingModule } from '@nestjs/testing';
import { APIGatewayController } from './api-gateway.controller';
import { RoutingService } from './routing/routing.service';
import { GatewayAuthService } from './auth/gateway-auth.service';
import { TransformService } from './transformation/transform.service';
import { GatewayMonitoringService } from './monitoring/gateway-monitoring.service';
import { PolicyEnforcementService } from './policies/policy-enforcement.service';
import { HttpStatus } from '@nestjs/common';

const mockReq = (overrides = {}) => ({
  method: 'GET',
  path: '/gateway/test',
  headers: {},
  body: {},
  ...overrides,
});
const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

describe('APIGatewayController', () => {
  let controller: APIGatewayController;
  let authService: GatewayAuthService;
  let policyService: PolicyEnforcementService;
  let routingService: RoutingService;
  let transformService: TransformService;
  let monitoringService: GatewayMonitoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [APIGatewayController],
      providers: [
        RoutingService,
        GatewayAuthService,
        TransformService,
        GatewayMonitoringService,
        PolicyEnforcementService,
      ],
    })
      .overrideProvider(GatewayAuthService)
      .useValue({ authenticate: jest.fn() })
      .overrideProvider(PolicyEnforcementService)
      .useValue({ enforcePolicies: jest.fn() })
      .overrideProvider(RoutingService)
      .useValue({ routeRequest: jest.fn() })
      .overrideProvider(TransformService)
      .useValue({
        transformRequest: jest.fn((req) => req),
        transformResponse: jest.fn((res) => res),
      })
      .overrideProvider(GatewayMonitoringService)
      .useValue({
        logRequest: jest.fn(),
        logResponse: jest.fn(),
        logError: jest.fn(),
        getMetrics: jest.fn().mockResolvedValue('metrics'),
      })
      .compile();

    controller = module.get<APIGatewayController>(APIGatewayController);
    authService = module.get(GatewayAuthService);
    policyService = module.get(PolicyEnforcementService);
    routingService = module.get(RoutingService);
    transformService = module.get(TransformService);
    monitoringService = module.get(GatewayMonitoringService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('proxies request successfully with valid auth', async () => {
    (authService.authenticate as jest.Mock).mockResolvedValue(true);
    (policyService.enforcePolicies as jest.Mock).mockResolvedValue(true);
    (routingService.routeRequest as jest.Mock).mockResolvedValue({
      status: 200,
      service: 'test-service',
      endpoint: '/test',
      method: 'GET',
      body: { foo: 'bar' },
      headers: {},
    });
    const req = mockReq();
    const res = mockRes();
    await controller.proxy(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
  });

  it('returns 401 for unauthorized request', async () => {
    (authService.authenticate as jest.Mock).mockResolvedValue(false);
    const req = mockReq();
    const res = mockRes();
    await controller.proxy(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('returns 429 for rate limit exceeded', async () => {
    (authService.authenticate as jest.Mock).mockResolvedValue(true);
    (policyService.enforcePolicies as jest.Mock).mockResolvedValue(false);
    const req = mockReq();
    const res = mockRes();
    await controller.proxy(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'Rate limit exceeded' });
  });

  it('handles XML->JSON transformation', async () => {
    (authService.authenticate as jest.Mock).mockResolvedValue(true);
    (policyService.enforcePolicies as jest.Mock).mockResolvedValue(true);
    (routingService.routeRequest as jest.Mock).mockResolvedValue({
      status: 200,
      service: 'test-service',
      endpoint: '/test',
      method: 'POST',
      body: { foo: 'bar' },
      headers: {},
    });
    (transformService.transformRequest as jest.Mock).mockImplementation((req) => {
      if (req.headers['content-type'] === 'application/xml') {
        req.body = { foo: 'bar' };
        req.headers['content-type'] = 'application/json';
      }
      return req;
    });
    const req = mockReq({ method: 'POST', headers: { 'content-type': 'application/xml' }, body: '<foo>bar</foo>' });
    const res = mockRes();
    await controller.proxy(req as any, res as any);
    expect(transformService.transformRequest).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
  });

  it('exposes monitoring metrics', async () => {
    const metrics = await monitoringService.getMetrics();
    expect(metrics).toBe('metrics');
  });
}); 