import { Controller, Get, Header, Logger, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { MetricsCollectionService } from './metrics-collection.service';

/**
 * Exposes a Prometheus-compatible `/metrics` scrape endpoint.
 *
 * The endpoint returns metrics in the standard Prometheus text exposition
 * format (text/plain; version=0.0.4).
 *
 * Optional bearer-token protection:
 *   Set METRICS_AUTH_TOKEN in the environment to require
 *   `Authorization: Bearer <token>` on every scrape request.
 *   Leave blank / unset to allow unauthenticated access (suitable for
 *   internal network scraping where the endpoint is not publicly routed).
 */
@ApiTags('Metrics')
@Controller()
export class PrometheusController {
  private readonly logger = new Logger(PrometheusController.name);
  private readonly authToken: string | undefined;

  constructor(private readonly metricsCollectionService: MetricsCollectionService) {
    this.authToken = process.env.METRICS_AUTH_TOKEN || undefined;
  }

  /**
   * Prometheus scrape endpoint.
   *
   * Returns all registered metrics (default Node.js system metrics + custom
   * TeachLink business metrics) in Prometheus text format.
   */
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Prometheus metrics scrape endpoint',
    description:
      'Returns all registered Prometheus metrics in text exposition format. ' +
      'Includes default Node.js runtime metrics (CPU, memory, event loop lag) ' +
      'plus custom TeachLink business metrics.',
  })
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics in text/plain exposition format',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized – invalid or missing bearer token' })
  @ApiExcludeEndpoint(false)
  async getMetrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.assertAuthorized(req);

    return this.sendPrometheusMetrics(req, res);
  }

  @Get('observability/metrics/export/prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Legacy observability endpoint for Prometheus metrics export',
    description:
      'Alias for the Prometheus scrape endpoint to support legacy observability integrations.',
  })
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics in text/plain exposition format',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized – invalid or missing bearer token' })
  async exportPrometheusMetrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.assertAuthorized(req);
    return this.sendPrometheusMetrics(req, res);
  }

  private async sendPrometheusMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.metricsCollectionService.getMetrics();
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(200).send(metrics);
    } catch (error) {
      this.logger.error(
        'Failed to collect Prometheus metrics',
        error instanceof Error ? error.stack : String(error),
      );
      res.status(500).send('# Error collecting metrics\n');
    }
  }

  /**
   * Validates bearer token when METRICS_AUTH_TOKEN is configured.
   * Throws UnauthorizedException on failure.
   */
  private assertAuthorized(req: Request): void {
    if (!this.authToken) {
      // No token configured – open access
      return;
    }

    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Metrics endpoint requires a valid bearer token');
    }

    const provided = authHeader.slice('Bearer '.length).trim();
    if (provided !== this.authToken) {
      this.logger.warn(`Metrics scrape rejected – invalid token from ${req.ip}`);
      throw new UnauthorizedException('Invalid metrics bearer token');
    }
  }
}
