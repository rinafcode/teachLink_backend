import { Controller, Get, HttpCode, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthIndicatorsService, PaymentProviderHealthResult } from '../health-indicators.service';

/**
 * Exposes /health/payment-provider as a dedicated sub-check so that
 * monitoring systems (e.g. Prometheus, Grafana, uptime robots) can alert on
 * the payment-gateway circuit state independently of the main health endpoint.
 */
@ApiTags('Health')
@Controller('health/payment-provider')
export class PaymentProviderHealthController {
  constructor(private readonly healthIndicators: HealthIndicatorsService) {}

  @Get()
  @ApiOperation({
    summary: 'Payment provider circuit-breaker health',
    description:
      'Returns the current circuit-breaker state for the payment provider. ' +
      'HTTP 200 when circuit is CLOSED (up), HTTP 503 when OPEN (down), ' +
      'HTTP 207 when HALF_OPEN (degraded).',
  })
  @ApiResponse({ status: 200, description: 'Payment provider is healthy (circuit CLOSED)' })
  @ApiResponse({ status: 207, description: 'Payment provider is degraded (circuit HALF_OPEN)' })
  @ApiResponse({ status: 503, description: 'Payment provider is unavailable (circuit OPEN)' })
  getPaymentProviderHealth(): PaymentProviderHealthResult {
    const result = this.healthIndicators.checkPaymentProvider();

    // Response status reflects circuit state so load-balancers / uptime monitors
    // can act on it without parsing the body.
    if (result.status === 'down') {
      // NestJS does not allow dynamic status codes via decorators, so we throw
      // instead — but we still want to return the body. Use HttpException directly.
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }

    if (result.status === 'degraded') {
      throw new HttpException(result, 207);
    }

    return result;
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Payment provider circuit-breaker status (always 200)',
    description:
      'Always returns HTTP 200 with circuit state in the body — useful for dashboards ' +
      'that poll metrics without relying on HTTP status semantics.',
  })
  @ApiResponse({ status: 200, description: 'Circuit-breaker status payload' })
  getPaymentProviderStatus(): PaymentProviderHealthResult {
    return this.healthIndicators.checkPaymentProvider();
  }
}
