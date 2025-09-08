import { Test, TestingModule } from '@nestjs/testing';
import { StreamingModule } from './streaming.module';
import { DataPipelineService } from './pipelines/data-pipeline.service';
import { EventSourcingService } from './event-sourcing/event-sourcing.service';
import { CQRSService } from './cqrs/cqrs.service';
import { RealTimeAnalyticsService } from './analytics/real-time-analytics.service';
import { StreamOptimizationService } from './optimization/stream-optimization.service';
import { StreamingController } from './controllers/streaming.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

// Mock JwtAuthGuard
class MockJwtAuthGuard {
  canActivate() {
    return true;
  }
}

describe('StreamingModule Integration', () => {
  let module: TestingModule;
  let dataPipelineService: DataPipelineService;
  let eventSourcingService: EventSourcingService;
  let cqrsService: CQRSService;
  let analyticsService: RealTimeAnalyticsService;
  let optimizationService: StreamOptimizationService;
  let controller: StreamingController;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [StreamingModule],
      providers: [
        {
          provide: JwtAuthGuard,
          useClass: MockJwtAuthGuard,
        },
      ],
    }).compile();

    dataPipelineService = module.get<DataPipelineService>(DataPipelineService);
    eventSourcingService = module.get<EventSourcingService>(EventSourcingService);
    cqrsService = module.get<CQRSService>(CQRSService);
    analyticsService = module.get<RealTimeAnalyticsService>(RealTimeAnalyticsService);
    optimizationService = module.get<StreamOptimizationService>(StreamOptimizationService);
    controller = module.get<StreamingController>(StreamingController);
  });

  it('should have all services defined', () => {
    expect(dataPipelineService).toBeDefined();
    expect(eventSourcingService).toBeDefined();
    expect(cqrsService).toBeDefined();
    expect(analyticsService).toBeDefined();
    expect(optimizationService).toBeDefined();
    expect(controller).toBeDefined();
  });

  describe('End-to-end event flow', () => {
    it('should process events through the pipeline and track analytics', async () => {
      // Set up command handler
      cqrsService.registerCommandHandler('ProcessOrder', async (command) => {
        // Process the order command
        const orderId = command.payload.orderId;
        
        // Store event in event sourcing
        eventSourcingService.storeEvent({
          aggregateId: orderId,
          aggregateType: 'order',
          eventType: 'OrderProcessed',
          data: { orderId, status: 'processed' },
          metadata: { userId: command.metadata.userId },
          version: 1,
        });
        
        // Track analytics metric
        analyticsService.trackMetric({
          key: 'orders_processed',
          value: 1,
          dimensions: { status: 'processed' },
          timestamp: Date.now(),
        });
        
        // Track performance metric
        optimizationService.trackMetric('throughput', 1);
        
        return { success: true, orderId };
      });

      // Set up analytics time window
      const aggregation = analyticsService.createTimeWindowAggregation({
        key: 'orders_processed',
        windowSize: 1000, // 1 second
        aggregationType: 'sum',
      });

      // Subscribe to the aggregation
      const aggregationPromise = firstValueFrom(aggregation.pipe(take(1)));

      // Execute a command through the controller
      const commandResult = await controller.executeCommand({
        type: 'ProcessOrder',
        payload: { orderId: 'order-123' },
        metadata: { userId: 'user-1' },
      });

      expect(commandResult.status).toBe('success');

      // Verify event was stored
      const events = eventSourcingService.getEvents('order-123', 'order');
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('OrderProcessed');

      // Wait for aggregation result
      const aggregationResult = await aggregationPromise;
      expect(aggregationResult.key).toBe('orders_processed');
      expect(aggregationResult.value).toBe(1);

      // Verify performance metrics were tracked
      const metrics = optimizationService.getCurrentMetrics();
      expect(metrics.throughput).toBe(1);
    });
  });

  describe('Event sourcing and CQRS integration', () => {
    it('should rebuild aggregate state from events when handling a query', async () => {
      // Register a query handler that uses event sourcing
      cqrsService.registerQueryHandler('GetOrderStatus', async (query) => {
        const orderId = query.payload.orderId;
        
        // Define event handlers for rebuilding state
        const eventHandlers = {
          OrderCreated: (state, event) => ({ ...state, ...event.data, status: 'created' }),
          OrderProcessed: (state, event) => ({ ...state, ...event.data, status: 'processed' }),
          OrderShipped: (state, event) => ({ ...state, ...event.data, status: 'shipped' }),
        };
        
        // Rebuild state from events
        const orderState = eventSourcingService.rebuildAggregateState(
          orderId,
          'order',
          { status: 'unknown' }, // Initial state
          eventHandlers,
        );
        
        return orderState;
      });

      // Store some events
      const orderId = 'order-456';
      
      eventSourcingService.storeEvent({
        aggregateId: orderId,
        aggregateType: 'order',
        eventType: 'OrderCreated',
        data: { orderId, customerName: 'Jane Doe' },
        metadata: { userId: 'admin-1' },
        version: 1,
      });
      
      eventSourcingService.storeEvent({
        aggregateId: orderId,
        aggregateType: 'order',
        eventType: 'OrderProcessed',
        data: { orderId, processingTime: '10ms' },
        metadata: { userId: 'admin-1' },
        version: 2,
      });

      // Execute query through controller
      const queryResult = await controller.executeQuery({
        type: 'GetOrderStatus',
        payload: { orderId },
        metadata: { userId: 'user-1' },
      });

      expect(queryResult.status).toBe('success');
      expect(queryResult.result).toEqual({
        orderId,
        customerName: 'Jane Doe',
        processingTime: '10ms',
        status: 'processed',
      });
    });
  });

  describe('Analytics and optimization integration', () => {
    it('should detect performance issues and apply optimization strategies', () => {
      // Track metrics indicating performance issues
      optimizationService.trackMetric('throughput', 1000);
      optimizationService.trackMetric('latency', 500); // High latency
      optimizationService.trackMetric('backpressure', 0.9); // High backpressure

      // Detect performance issues
      const issues = optimizationService.detectPerformanceIssues({
        latencyThreshold: 100,
        throughputThreshold: 1500,
        backpressureThreshold: 0.7,
      });

      expect(issues).toHaveLength(2);
      expect(issues.some(issue => issue.type === 'high_latency')).toBe(true);
      expect(issues.some(issue => issue.type === 'high_backpressure')).toBe(true);

      // Apply throttling strategy
      const throttlingResult = optimizationService.applyThrottling(800);
      expect(throttlingResult.applied).toBe(true);

      // Apply buffering strategy
      const bufferingResult = optimizationService.applyBuffering(0.7, 2000);
      expect(bufferingResult.applied).toBe(true);
    });
  });
});