import { Controller, Post, Get, Body, Param, Query, HttpStatus, HttpCode, UseGuards } from '@nestjs/common';
import { DataPipelineService, StreamEvent } from '../pipelines/data-pipeline.service';
import { EventSourcingService } from '../event-sourcing/event-sourcing.service';
import { CQRSService } from '../cqrs/cqrs.service';
import { RealTimeAnalyticsService } from '../analytics/real-time-analytics.service';
import { StreamOptimizationService } from '../optimization/stream-optimization.service';
import { PublishEventDto, StreamSubscriptionDto, StreamSubscriptionResponseDto } from '../dto/stream-event.dto';
import { CommandDto, QueryDto, CommandResponseDto, QueryResponseDto } from '../dto/cqrs.dto';
import { AnalyticsMetricDto, TimeWindowConfigDto, AnomalyDetectionConfigDto } from '../dto/analytics.dto';
import { OptimizationStrategyConfigDto, StreamMonitoringConfigDto } from '../dto/optimization.dto';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('streaming')
@UseGuards(JwtAuthGuard)
export class StreamingController {
  constructor(
    private readonly dataPipelineService: DataPipelineService,
    private readonly eventSourcingService: EventSourcingService,
    private readonly cqrsService: CQRSService,
    private readonly analyticsService: RealTimeAnalyticsService,
    private readonly optimizationService: StreamOptimizationService,
  ) {}

  /**
   * Publish an event to the data pipeline
   */
  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  publishEvent(@Body() eventDto: PublishEventDto): { success: boolean; eventId: string } {
    const event: StreamEvent = {
      ...eventDto,
      timestamp: eventDto.timestamp || Date.now(),
    };

    this.dataPipelineService.publishEvent(event);
    return { success: true, eventId: event.id };
  }

  /**
   * Subscribe to a specific event type
   */
  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  createSubscription(
    @Body() subscriptionDto: StreamSubscriptionDto,
  ): StreamSubscriptionResponseDto {
    const subscriptionId = uuidv4();
    
    // In a real implementation, this would set up SSE or WebSocket
    // For now, we just return the subscription details
    
    return {
      subscriptionId,
      eventType: subscriptionDto.eventType,
      status: 'active',
      message: `Subscription created for event type: ${subscriptionDto.eventType}`,
    };
  }

  /**
   * Execute a command
   */
  @Post('commands')
  @HttpCode(HttpStatus.ACCEPTED)
  async executeCommand(@Body() commandDto: CommandDto): Promise<CommandResponseDto> {
    const commandId = uuidv4();
    
    try {
      const result = await this.cqrsService.executeCommand({
        ...commandDto,
      });
      
      return {
        commandId,
        status: 'success',
        result,
      };
    } catch (error) {
      return {
        commandId,
        status: 'error',
        message: error.message,
      };
    }
  }

  /**
   * Execute a query
   */
  @Post('queries')
  @HttpCode(HttpStatus.OK)
  async executeQuery(@Body() queryDto: QueryDto): Promise<QueryResponseDto> {
    const queryId = uuidv4();
    
    try {
      const result = await this.cqrsService.executeQuery({
        ...queryDto,
      });
      
      return {
        queryId,
        status: 'success',
        result,
      };
    } catch (error) {
      return {
        queryId,
        status: 'error',
        message: error.message,
      };
    }
  }

  /**
   * Track an analytics metric
   */
  @Post('analytics/metrics')
  @HttpCode(HttpStatus.CREATED)
  trackMetric(@Body() metricDto: AnalyticsMetricDto): { success: boolean } {
    this.analyticsService.trackMetric({
      ...metricDto,
      timestamp: metricDto.timestamp || Date.now(),
    });
    
    return { success: true };
  }

  /**
   * Get aggregation history for a specific key
   */
  @Get('analytics/aggregations/:key')
  getAggregationHistory(@Param('key') key: string) {
    return this.analyticsService.getAggregationHistory(key);
  }

  /**
   * Configure anomaly detection
   */
  @Post('analytics/anomalies')
  @HttpCode(HttpStatus.CREATED)
  configureAnomalyDetection(@Body() config: AnomalyDetectionConfigDto): { success: boolean } {
    // In a real implementation, this would set up the anomaly detection
    // For now, we just return success
    
    return { success: true };
  }

  /**
   * Get current performance metrics
   */
  @Get('optimization/metrics')
  getPerformanceMetrics() {
    return this.optimizationService.getCurrentMetrics();
  }

  /**
   * Configure optimization strategy
   */
  @Post('optimization/strategies')
  @HttpCode(HttpStatus.CREATED)
  configureOptimizationStrategy(
    @Body() config: OptimizationStrategyConfigDto,
  ): { success: boolean } {
    // In a real implementation, this would configure the optimization strategy
    // For now, we just return success
    
    return { success: true };
  }

  /**
   * Configure stream monitoring
   */
  @Post('optimization/monitoring')
  @HttpCode(HttpStatus.CREATED)
  configureStreamMonitoring(
    @Body() config: StreamMonitoringConfigDto,
  ): { success: boolean } {
    // In a real implementation, this would configure the stream monitoring
    // For now, we just return success
    
    return { success: true };
  }

  /**
   * Get events for a specific aggregate
   */
  @Get('events/:aggregateType/:aggregateId')
  getEvents(
    @Param('aggregateType') aggregateType: string,
    @Param('aggregateId') aggregateId: string,
  ) {
    return this.eventSourcingService.getEvents(aggregateId, aggregateType);
  }

  /**
   * Get the latest snapshot for an aggregate
   */
  @Get('snapshots/:aggregateType/:aggregateId')
  getLatestSnapshot(
    @Param('aggregateType') aggregateType: string,
    @Param('aggregateId') aggregateId: string,
  ) {
    return this.eventSourcingService.getLatestSnapshot(aggregateId, aggregateType);
  }
}