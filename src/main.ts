import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// ============================================================
// TODO: Uncomment when monitoring modules are created
// ============================================================
// import { Registry } from 'prom-client';
// import { NodeSDK } from '@opentelemetry/sdk-node';
// import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
// import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
// import { PerformanceInterceptor } from './monitoring/interceptors/performance.interceptor';
// import { MetricsCollectionService } from './monitoring/metrics/metrics-collection.service';

async function bootstrap() {
  // ============================================================
  // TODO: Uncomment OpenTelemetry setup when monitoring is ready
  // ============================================================
  // const prometheusPort = 9464;
  // const prometheusExporter = new PrometheusExporter({ port: prometheusPort });
  // const sdk = new NodeSDK({});
  // await sdk.start();

  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ============================================================
  // TODO: Uncomment when monitoring interceptor is created
  // ============================================================
  // const metricsCollectionService = app.get(MetricsCollectionService);
  // app.useGlobalInterceptors(
  //   new PerformanceInterceptor(metricsCollectionService),
  // );

  // Configure Swagger
  const config = new DocumentBuilder()
    .setTitle('TeachLink API')
    .setDescription('The TeachLink API documentation - Email Marketing System')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Email Marketing - Campaigns', 'Create and manage email campaigns')
    .addTag('Email Marketing - Templates', 'Email template management')
    .addTag('Email Marketing - Automation', 'Automation workflows')
    .addTag('Email Marketing - Segments', 'Audience segmentation')
    .addTag('Email Marketing - A/B Testing', 'A/B testing for campaigns')
    .addTag('Email Marketing - Analytics', 'Campaign analytics and reporting')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // ============================================================
  // TODO: Uncomment when gateway monitoring is created
  // ============================================================
  // const { GatewayMonitoringService } = await import(
  //   './api-gateway/monitoring/gateway-monitoring.service'
  // );
  // const monitoringService = app.get(GatewayMonitoringService);
  // app
  //   .getHttpAdapter()
  //   .getInstance()
  //   .get('/metrics', async (req, res) => {
  //     res.set('Content-Type', 'text/plain');
  //     res.send(await monitoringService.getMetrics());
  //   });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 TeachLink API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs available at http://localhost:${port}/api`);
}
bootstrap();
