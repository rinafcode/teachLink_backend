import { Controller, Get, Param, Query, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { QueueAnalyticsService, QueuePerformanceMetrics } from '../analytics/queue-analytics.service';
import { QueueDashboardService, DashboardData } from '../dashboard/queue-dashboard.service';
import { QueueEventPipelineService, QueueEvent } from '../streaming/queue-event-pipeline.service';
import { AnalyticsMetric } from '../../streaming/analytics/real-time-analytics.service';

/**
 * Controller for queue analytics and dashboard endpoints
 */
@Controller('api/queues/analytics')
export class QueueAnalyticsController {
  constructor(
    private readonly queueAnalyticsService: QueueAnalyticsService,
    private readonly queueDashboardService: QueueDashboardService,
    private readonly queueEventPipelineService: QueueEventPipelineService,
  ) {}

  /**
   * Get real-time performance metrics for a queue
   * @param queueName The queue name
   */
  @Get('performance/:queueName?')
  getPerformanceMetrics(@Param('queueName') queueName?: string): QueuePerformanceMetrics {
    return this.queueAnalyticsService.getQueuePerformanceMetrics(queueName);
  }

  /**
   * Get dashboard data for a queue
   * @param queueName The queue name
   */
  @Get('dashboard/:queueName?')
  async getDashboardData(@Param('queueName') queueName?: string): Promise<DashboardData> {
    return this.queueDashboardService.getDashboardData(queueName);
  }

  /**
   * Get historical performance data for a queue
   * @param queueName The queue name
   * @param timeRange The time range in milliseconds
   */
  @Get('history/:queueName?')
  async getHistoricalData(
    @Param('queueName') queueName?: string,
    @Query('timeRange') timeRange?: number,
  ): Promise<any> {
    return this.queueDashboardService.getHistoricalPerformanceData(
      queueName,
      timeRange ? parseInt(timeRange.toString(), 10) : undefined,
    );
  }

  /**
   * Stream real-time queue metrics
   * @param metricName The metric name
   */
  @Sse('metrics/stream')
  streamMetrics(@Query('metric') metricName?: string): Observable<MessageEvent> {
    const source = metricName
      ? this.queueAnalyticsService.observeQueueMetric(metricName)
      : this.queueAnalyticsService.observeQueueMetric('*');
    
    return source.pipe(
      map((metric: AnalyticsMetric) => ({
        data: metric,
        type: 'metric',
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      })),
    );
  }

  /**
   * Stream real-time queue events
   * @param eventType The event type
   * @param queueName The queue name
   */
  @Sse('events/stream')
  streamEvents(
    @Query('type') eventType?: string,
    @Query('queue') queueName?: string,
  ): Observable<MessageEvent> {
    let source: Observable<QueueEvent>;
    
    if (eventType) {
      source = this.queueEventPipelineService.subscribeToEventType(eventType);
    } else if (queueName) {
      source = this.queueEventPipelineService.subscribeToQueueEvents(queueName);
    } else {
      source = this.queueEventPipelineService.subscribeToAllEvents();
    }
    
    return source.pipe(
      map((event: QueueEvent) => ({
        data: event,
        type: 'event',
        id: event.id,
      })),
    );
  }

  /**
   * Replay queue events
   * @param queueName The queue name
   * @param startTime The start time
   * @param endTime The end time
   */
  @Get('events/replay/:queueName')
  async replayEvents(
    @Param('queueName') queueName: string,
    @Query('startTime') startTime?: number,
    @Query('endTime') endTime?: number,
  ): Promise<QueueEvent[]> {
    return this.queueEventPipelineService.replayQueueEvents(
      queueName,
      startTime ? parseInt(startTime.toString(), 10) : undefined,
      endTime ? parseInt(endTime.toString(), 10) : undefined,
    );
  }
}