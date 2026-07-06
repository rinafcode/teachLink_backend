import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrometheusController } from './prometheus.controller';
import { MetricsCollectionService } from './metrics-collection.service';

/** Minimal mock for MetricsCollectionService */
const mockMetricsCollectionService = {
  getMetrics: jest.fn(),
};

/** Creates a minimal fake Express Request */
function buildRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ip: '127.0.0.1',
    method: 'GET',
    path: '/metrics',
    ...overrides,
  } as unknown as Request;
}

/** Creates a minimal fake Express Response with spies */
function buildResponse(): Response & {
  setHeaderSpy: jest.Mock;
  statusSpy: jest.Mock;
  sendSpy: jest.Mock;
} {
  const sendSpy = jest.fn();
  const statusSpy = jest.fn().mockReturnValue({ send: sendSpy });
  const setHeaderSpy = jest.fn();

  return {
    setHeader: setHeaderSpy,
    status: statusSpy,
    setHeaderSpy,
    statusSpy,
    sendSpy,
  } as unknown as Response & {
    setHeaderSpy: jest.Mock;
    statusSpy: jest.Mock;
    sendSpy: jest.Mock;
  };
}

describe('PrometheusController', () => {
  let controller: PrometheusController;

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.METRICS_AUTH_TOKEN;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrometheusController],
      providers: [{ provide: MetricsCollectionService, useValue: mockMetricsCollectionService }],
    }).compile();

    controller = module.get<PrometheusController>(PrometheusController);
  });

  afterEach(() => {
    delete process.env.METRICS_AUTH_TOKEN;
  });

  // ── Happy-path tests ──────────────────────────────────────────────────────

  describe('GET /metrics – unauthenticated (no token configured)', () => {
    it('returns 200 with Prometheus text body', async () => {
      const metricText = '# HELP process_cpu_seconds_total\n# TYPE counter\n';
      mockMetricsCollectionService.getMetrics.mockResolvedValue(metricText);

      const req = buildRequest();
      const res = buildResponse();

      await controller.getMetrics(req, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; version=0.0.4; charset=utf-8',
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.statusSpy().send).toHaveBeenCalledWith(metricText);
    });

    it('returns 200 from the legacy observability alias endpoint', async () => {
      const metricText = '# HELP process_memory_bytes\n# TYPE gauge\n';
      mockMetricsCollectionService.getMetrics.mockResolvedValue(metricText);

      const req = buildRequest({ path: '/observability/metrics/export/prometheus' });
      const res = buildResponse();

      await controller.exportPrometheusMetrics(req, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; version=0.0.4; charset=utf-8',
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.statusSpy().send).toHaveBeenCalledWith(metricText);
    });

    it('returns 500 when getMetrics throws', async () => {
      mockMetricsCollectionService.getMetrics.mockRejectedValue(new Error('prom-client error'));

      const req = buildRequest();
      const res = buildResponse();

      await controller.getMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ── Auth-enabled tests ────────────────────────────────────────────────────

  describe('GET /metrics – with METRICS_AUTH_TOKEN configured', () => {
    const TOKEN = 'super-secret-scrape-token';

    beforeEach(async () => {
      process.env.METRICS_AUTH_TOKEN = TOKEN;

      // Re-create the module so the controller reads the updated env var
      const module: TestingModule = await Test.createTestingModule({
        controllers: [PrometheusController],
        providers: [{ provide: MetricsCollectionService, useValue: mockMetricsCollectionService }],
      }).compile();

      controller = module.get<PrometheusController>(PrometheusController);
    });

    it('returns 200 when bearer token matches', async () => {
      mockMetricsCollectionService.getMetrics.mockResolvedValue('# metric data\n');

      const req = buildRequest({
        headers: { authorization: `Bearer ${TOKEN}` },
      });
      const res = buildResponse();

      await expect(controller.getMetrics(req, res)).resolves.toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('throws UnauthorizedException when Authorization header is missing', async () => {
      const req = buildRequest({ headers: {} });
      const res = buildResponse();

      await expect(controller.getMetrics(req, res)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when bearer token is wrong', async () => {
      const req = buildRequest({
        headers: { authorization: 'Bearer wrong-token' },
      });
      const res = buildResponse();

      await expect(controller.getMetrics(req, res)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when Authorization format is not Bearer', async () => {
      const req = buildRequest({
        headers: { authorization: `Basic ${TOKEN}` },
      });
      const res = buildResponse();

      await expect(controller.getMetrics(req, res)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // ── Content-type header ───────────────────────────────────────────────────

  it('sets the correct Prometheus content-type header', async () => {
    mockMetricsCollectionService.getMetrics.mockResolvedValue('');

    const req = buildRequest();
    const res = buildResponse();

    await controller.getMetrics(req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4; charset=utf-8',
    );
  });
});
