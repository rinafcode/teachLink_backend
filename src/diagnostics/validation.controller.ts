import { Controller, Post, Body, HttpCode, Get, Header } from '@nestjs/common';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CostTrackingService } from '../monitoring/cost-tracking.service';

// Lightweight diagnostics controller used for local validation/testing.
// It instantiates local metric services to avoid touching application DI.
const metrics = new MetricsCollectionService();
const analytics = new AnalyticsService(metrics);
const costTracker = new CostTrackingService(metrics);

@Controller()
export class ValidationController {
  @Post('analytics/event')
  @HttpCode(202)
  handleAnalyticsEvent(@Body() body: { category: string; action: string; label?: string; value?: number }) {
    const { category, action, label, value } = body || {};
    analytics.recordEvent(category ?? 'unknown', action ?? 'unknown', label, value);
    return { status: 'accepted' };
  }

  @Post('metrics/cost')
  @HttpCode(202)
  handleCostEvent(@Body() body: { amountUsd: number }) {
    const amount = Number(body?.amountUsd ?? 0);
    costTracker.recordHourlyCost(isNaN(amount) ? 0 : amount);
    return { status: 'accepted' };
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async getMetrics() {
    return metrics.getMetrics();
  }
}
