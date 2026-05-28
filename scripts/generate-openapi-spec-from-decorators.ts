/**
 * Generate OpenAPI spec from NestJS Swagger decorators
 * This script scans NestJS controllers and generates an OpenAPI spec automatically
 * 
 * When controllers are properly decorated with @ApiTags, @ApiOperation, @ApiResponse,
 * etc., this script can extract the metadata and generate the spec automatically.
 * 
 * Usage: npx ts-node scripts/generate-openapi-spec-from-decorators.ts
 * Or after building: node dist/scripts/generate-openapi-spec-from-decorators.js
 */

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('TeachLink API')
    .setDescription(
      'Automatically generated OpenAPI documentation for TeachLink backend APIs, including request and response examples.',
    )
    .setVersion(process.env.npm_package_version || '0.0.1')
    .addServer('http://localhost:3000', 'Local development')
    .addServer('https://api.staging.teachlink.com', 'Staging')
    .addServer('https://api.teachlink.com', 'Production')
    .addBearerAuth()
    .addTag('App', 'Service metadata and status')
    .addTag('Auth', 'Registration, login, and token management')
    .addTag('Users', 'User account management')
    .addTag('Courses', 'Course catalog and authoring')
    .addTag('Payments', 'Payments, subscriptions, and refunds')
    .addTag('Search', 'Search, filters, autocomplete, and analytics')
    .addTag('Gamification', 'Gamification and user rewards')
    .addTag('Email Marketing - Campaigns', 'Create and manage email campaigns')
    .addTag('Email Marketing - Templates', 'Email template management')
    .addTag('Email Marketing - Automation', 'Automation workflows')
    .addTag('Email Marketing - Segments', 'Audience segmentation')
    .addTag('Email Marketing - A/B Testing', 'A/B testing for campaigns')
    .addTag('Email Marketing - Analytics', 'Campaign analytics and reporting')
    .addTag('Analytics', 'User activity tracking and insights')
    .addTag('Notifications', 'Push notifications and alerts')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outputPath = path.join(process.cwd(), 'openapi-spec.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));

  console.log(`✅ Generated OpenAPI spec with ${Object.keys(document.paths).length} paths`);
  console.log(`   Output: ${outputPath}`);

  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Failed to generate OpenAPI spec:', err.message);
  process.exit(1);
});
