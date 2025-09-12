import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Registry } from 'prom-client';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
// import { Resource } from '@opentelemetry/resources'; // Not used due to version/type issues
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PerformanceInterceptor } from './monitoring/interceptors/performance.interceptor';
import { MetricsCollectionService } from './monitoring/metrics/metrics-collection.service';

async function bootstrap() {
  // OpenTelemetry setup
  const prometheusPort = 9464;
  const prometheusExporter = new PrometheusExporter({ port: prometheusPort });
  // If you want to set the service name, set OTEL_SERVICE_NAME=teachlink-api-gateway in your environment
  const sdk = new NodeSDK({
    // resource: ... (removed due to type/value issues)
    // metricsExporter: prometheusExporter, // Uncomment if supported by your OpenTelemetry version
    // If metricsExporter is not supported, PrometheusExporter will still expose metrics on the port
  });
  await sdk.start();

  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Enable validation
  app.useGlobalPipes(new ValidationPipe());

  // Apply global performance interceptor for monitoring/logging
  const metricsCollectionService = app.get(MetricsCollectionService);
  app.useGlobalInterceptors(
    new PerformanceInterceptor(metricsCollectionService),
  );

  // Configure Swagger
  const config = new DocumentBuilder()
    .setTitle('TeachLink API')
    .setDescription('The TeachLink API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Expose /metrics endpoint for Prometheus
  const { GatewayMonitoringService } = await import(
    './api-gateway/monitoring/gateway-monitoring.service'
  );
  const monitoringService = app.get(GatewayMonitoringService);
  app
    .getHttpAdapter()
    .getInstance()
    .get('/metrics', async (req, res) => {
      res.set('Content-Type', 'text/plain');
      res.send(await monitoringService.getMetrics());
    });

  await app.listen(3000);
  // Prometheus metrics also available at http://localhost:9464/metrics
}
bootstrap();
