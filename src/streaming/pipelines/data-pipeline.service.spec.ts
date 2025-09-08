import { Test, TestingModule } from '@nestjs/testing';
import { DataPipelineService, StreamEvent, TransformFn, FilterFn } from './data-pipeline.service';
import { Observable } from 'rxjs';
import { take, toArray } from 'rxjs/operators';

describe('DataPipelineService', () => {
  let service: DataPipelineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataPipelineService],
    }).compile();

    service = module.get<DataPipelineService>(DataPipelineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishEvent and subscribeToEvents', () => {
    it('should publish events and allow subscription by event type', (done) => {
      // Create test events
      const testEvent1: StreamEvent = { id: '1', type: 'test-event', data: { value: 'test1' }, timestamp: Date.now() };
      const testEvent2: StreamEvent = { id: '2', type: 'test-event', data: { value: 'test2' }, timestamp: Date.now() };
      const testEvent3: StreamEvent = { id: '3', type: 'other-event', data: { value: 'test3' }, timestamp: Date.now() };
      
      // Subscribe to test-event type
      const subscription = service.subscribeToEvents('test-event')
        .pipe(take(2), toArray())
        .subscribe(events => {
          expect(events).toHaveLength(2);
          expect(events[0].id).toBe('1');
          expect(events[1].id).toBe('2');
          done();
        });
      
      // Publish events
      service.publishEvent(testEvent1);
      service.publishEvent(testEvent3); // This should not be received by our subscription
      service.publishEvent(testEvent2);
    });

    it('should allow subscription to all events when no type is specified', (done) => {
      // Create test events
      const testEvent1: StreamEvent = { id: '1', type: 'test-event', data: { value: 'test1' }, timestamp: Date.now() };
      const testEvent2: StreamEvent = { id: '2', type: 'other-event', data: { value: 'test2' }, timestamp: Date.now() };
      
      // Subscribe to all events
      const subscription = service.subscribeToEvents()
        .pipe(take(2), toArray())
        .subscribe(events => {
          expect(events).toHaveLength(2);
          expect(events[0].id).toBe('1');
          expect(events[1].id).toBe('2');
          done();
        });
      
      // Publish events
      service.publishEvent(testEvent1);
      service.publishEvent(testEvent2);
    });
  });

  describe('createTransformPipeline', () => {
    it('should transform events using the provided transform function', (done) => {
      // Create test events
      const testEvent: StreamEvent = { id: '1', type: 'test-event', data: { value: 10 }, timestamp: Date.now() };
      
      // Create transform function that doubles the value
      const transformFn: TransformFn = (event) => ({
        ...event,
        data: { value: event.data.value * 2 }
      });
      
      // Create transform pipeline
      const transformedStream = service.createTransformPipeline(
        service.subscribeToEvents('test-event'),
        transformFn
      );
      
      // Subscribe to transformed stream
      transformedStream.pipe(take(1)).subscribe(event => {
        expect(event.data.value).toBe(20); // Value should be doubled
        done();
      });
      
      // Publish event
      service.publishEvent(testEvent);
    });
  });

  describe('createFilterPipeline', () => {
    it('should filter events using the provided filter function', (done) => {
      // Create test events
      const testEvent1: StreamEvent = { id: '1', type: 'test-event', data: { value: 5 }, timestamp: Date.now() };
      const testEvent2: StreamEvent = { id: '2', type: 'test-event', data: { value: 15 }, timestamp: Date.now() };
      
      // Create filter function that only allows values > 10
      const filterFn: FilterFn = (event) => event.data.value > 10;
      
      // Create filter pipeline
      const filteredStream = service.createFilterPipeline(
        service.subscribeToEvents('test-event'),
        filterFn
      );
      
      // Subscribe to filtered stream
      filteredStream.pipe(take(1)).subscribe(event => {
        expect(event.id).toBe('2'); // Only the second event should pass the filter
        expect(event.data.value).toBe(15);
        done();
      });
      
      // Publish events
      service.publishEvent(testEvent1); // This should be filtered out
      service.publishEvent(testEvent2); // This should pass through
    });
  });

  describe('mergeEventStreams', () => {
    it('should merge multiple event streams', (done) => {
      // Create test events
      const testEvent1: StreamEvent = { id: '1', type: 'type-a', data: { source: 'A' }, timestamp: Date.now() };
      const testEvent2: StreamEvent = { id: '2', type: 'type-b', data: { source: 'B' }, timestamp: Date.now() };
      
      // Create two separate streams
      const streamA = service.subscribeToEvents('type-a');
      const streamB = service.subscribeToEvents('type-b');
      
      // Merge streams
      const mergedStream = service.mergeEventStreams([streamA, streamB]);
      
      // Subscribe to merged stream
      mergedStream.pipe(take(2), toArray()).subscribe(events => {
        expect(events).toHaveLength(2);
        expect(events[0].data.source).toBe('A');
        expect(events[1].data.source).toBe('B');
        done();
      });
      
      // Publish events to different streams
      service.publishEvent(testEvent1);
      service.publishEvent(testEvent2);
    });
  });
});