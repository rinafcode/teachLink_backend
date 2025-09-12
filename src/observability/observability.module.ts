import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { BullModule } from '@nestjs/bull';
import { ObservabilityService } from './observability.service';
import { DistributedTracingService } from './tracing/distributed-tracing.service';
import { LogAggregationService } from './logging/log-aggregation.service';
import { MetricsAnalysisService } from './metrics/metrics-analysis.service';
import { AnomalyDetectionService } from './anomaly/anomaly-detection.service';
import { TraceSpan } from './entities/trace-span.entity';
import { LogEntry } from './entities/log-entry.entity';
import { MetricEntry } from './entities/metric-entry.entity';
import { AnomalyAlert } from './entities/anomaly-alert.entity';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([TraceSpan, LogEntry, MetricEntry, AnomalyAlert]),
    ElasticsearchModule.register({
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD,
      },
      tls: process.env.ELASTICSEARCH_TLS === 'true' ? {} : undefined,
      maxRetries: 3,
      requestTimeout: 30000,
    }),
    BullModule.registerQueue(
      {
        name: 'log-aggregation',
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      },
      {
        name: 'metrics-analysis',
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      },
      {
        name: 'anomaly-detection',
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      },
    ),
  ],
  providers: [
    ObservabilityService,
    DistributedTracingService,
    LogAggregationService,
    MetricsAnalysisService,
    AnomalyDetectionService,
  ],
  exports: [
    ObservabilityService,
    DistributedTracingService,
    LogAggregationService,
    MetricsAnalysisService,
    AnomalyDetectionService,
  ],
})
export class ObservabilityModule {}
