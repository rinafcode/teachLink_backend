import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('TeachLink API')
    .setDescription('TeachLink backend API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Auth', 'Authentication and authorization endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Courses', 'Course management endpoints')
    .addTag('Payments', 'Payment processing endpoints')
    .addTag('Subscriptions', 'Subscription management endpoints')
    .addServer('http://localhost:3000', 'Local Development')
    .addServer('https://api.teachlink.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'TeachLink API Docs',
  });
}
