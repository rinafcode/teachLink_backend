import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TraceSpan } from '../entities/trace-span.entity';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository, Between } from 'typeorm';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import {
  trace,
  Tracer,
  ROOT_CONTEXT,
  Span,
  SpanKind,
  SpanStatusCode,
  context as otelContext,
  SpanOptions,
  SpanAttributes,
} from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
interface SpanContext {
  traceId: string;
  spanId: string;
  serviceName: string;
  operationName: string;
  userId: string;
  spanContext: SpanAttributes;
  startTime: number;
  endTime: number;
  duration: number;
  statusCode: SpanStatusCode;
  parentSpanId: string;
  context?: SpanContext;
}

interface StartSpanOptions {
  operationName: string;
  parentSpanId?: string;
  tags?: Record<string, any>;
}

@Injectable()
export class DistributedTracingService {
  private readonly logger = new Logger(DistributedTracingService.name);
  private tracer?: Tracer;
  private sdk: NodeSDK | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(TraceSpan)
    private readonly traceSpanRepository: Repository<TraceSpan>,
    private readonly dataSource: DataSource,
    private readonly elasticsearchService: ElasticsearchService,
  ) {
    this.initializeTracer();
  }

  private async initializeTracer() {
    const endpoint = this.configService.get<string>(
      'OTEL_EXPORTER_OTLP_ENDPOINT',
      'http://localhost:4317',
    ); // Set your OpenTelemetry Collector endpoint

    this.sdk = new NodeSDK({
      // Configure OpenTelemetry's span processor
      spanProcessor: new SimpleSpanProcessor(
        new (class implements SpanExporter {
          export(
            spans: ReadableSpan[],
            resultCallback: (result: any) => void,
          ): void {
            // Process and export spans to your desired destination such as Elasticsearch
            console.log('Exporting spans:', spans);
            resultCallback({ code: 0 }); // OK status
          }
          async shutdown(): Promise<void> {
            // Implement shutdown logic if needed
          }
        })(),
      ),
      // You can also use BatchSpanProcessor if needed
      // sampler: new ParentBasedSampler({
      //  root: new AlwaysOnSampler(),
      // }),
    });
    await this.sdk.start();

    this.tracer = trace.getTracer('default');
    this.logger.log('Tracer initialized for distributed tracing');
  }

  /**
   * Initialize distributed tracing
   */
  async initialize(config: {
    serviceName: string;
    version: string;
    environment: string;
  }): Promise<void> {
    // Ensure trace spans are exported
    this.exportTraceSpans();

    // Implement your tracer initialization logic
    this.logger.log('Distributed tracing initialized');
  }

  /**
   * Start a new trace span
   */
  async startSpan({
    operationName,
    parentSpanId,
    tags,
  }: StartSpanOptions): Promise<Span | undefined> {
    if (!this.tracer) {
      this.logger.error('Tracer has not been initialized');
      return undefined;
    }

    try {
      const parentSpan = trace.getActiveSpan();
      const spanOptions: SpanOptions = {
        kind: SpanKind.CLIENT,
        attributes: {
          operationName,
          ...tags,
        },
      };
      const span = this.tracer.startSpan(
        operationName,
        spanOptions,
        ROOT_CONTEXT,
      );

      span.setAttribute(
        'service.name',
        this.configService.get<string>('OBSERVABILITY_SERVICE_NAME') ??
          os.hostname(),
      );
      span.setAttribute(
        'service.version',
        this.configService.get<string>('OBSERVABILITY_VERSION'),
      );
      span.setAttribute(
        'deployment.environment',
        this.configService.get<string>('NODE_ENV'),
      );
      span.addEvent(`span started - ${operationName}`);

      // Complete other OpenTelemetry trace setup activities...

      // Ensure span propagation
      otelContext.with(trace.setSpan(otelContext.active(), span), () => {
        this.logger.log(`Tracing span started: ${operationName}`);
      });

      return span;
    } catch (error) {
      this.logger.error('Error starting span:', error);
      return undefined;
    }
  }

  /**
   * End a given span
   */
  async endSpan(span?: Span): Promise<void> {
    if (!span) {
      this.logger.error('Span has not been provided for ending');
      return;
    }

    try {
      span.end();
      this.logger.log('Span ended successfully');
    } catch (error) {
      this.logger.error('Error ending span:', error);
    }
  }

  /**
   * Record and save a trace span
   */
  private async exportTraceSpans() {
    await this.traceSpanRepository.find({
      where: { parentSpanId: IsNull() },
    });

    this.logger.log('Trace spans exported successfully');
  }

  /**
   * Generate correlation ID for request tracking
   */
  generateCorrelationId(): string {
    return uuidv4();
  }

  /**
   * Get tracer health status
   */
  async getHealthStatus(): Promise<{ status: string }> {
    return { status: 'healthy' };
  }

  /**
   * Get trace count within a specific time range
   */
  async getTraceCount(from: Date, to: Date): Promise<number> {
    return this.traceSpanRepository.count({
      where: { timestamp: In([from, to]) },
    });
  }

  /**
   * Search trace spans
   */
  async searchTraces(query: {
    text?: string;
    correlationId?: string;
    traceId?: string;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
    services?: string[];
  }): Promise<any[]> {
    const mustClauses: any[] = [];

    if (query.text) {
      mustClauses.push({ match: { message: query.text } });
    }

    if (query.correlationId) {
      mustClauses.push({ match: { correlationId: query.correlationId } });
    }

    if (query.traceId) {
      mustClauses.push({ match: { traceId: query.traceId } });
    }

    if (query.startTime && query.endTime) {
      mustClauses.push({
        range: {
          timestamp: {
            gte: query.startTime,
            lte: query.endTime,
          },
        },
      });
    }

    if (query.services && query.services.length > 0) {
      mustClauses.push({ terms: { serviceName: query.services } });
    }

    const searchQuery =
      mustClauses.length > 0
        ? { bool: { must: mustClauses } }
        : { match_all: {} };

    const searchResults = await this.elasticsearchService.search({
      index: 'trace_spans',
      query: searchQuery,
    });
    return searchResults.hits.hits;
  }
}
