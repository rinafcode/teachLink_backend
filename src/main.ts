import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/interceptors/global-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // ─── Global Exception Filter ──────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors();

  // ─── Validation ──────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ─── Swagger ──────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('TeachLink API')
    .setDescription('The TeachLink API documentation - Unified System')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('gamification', 'Gamification and user rewards')
    .addTag('Email Marketing - Campaigns', 'Create and manage email campaigns')
    .addTag('Email Marketing - Templates', 'Email template management')
    .addTag('Email Marketing - Automation', 'Automation workflows')
    .addTag('Email Marketing - Segments', 'Audience segmentation')
    .addTag('Email Marketing - A/B Testing', 'A/B testing for campaigns')
    .addTag('Email Marketing - Analytics', 'Campaign analytics and reporting')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 TeachLink API running on http://localhost:${port}`);
  logger.log(`📚 Swagger docs available at http://localhost:${port}/api`);
}
bootstrap();
