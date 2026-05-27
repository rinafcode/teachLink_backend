import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    const app = await NestFactory.create(AppModule);

    // Enable CORS
    app.enableCors({
      origin: true,
      credentials: true,
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('TeachLink API')
      .setDescription('TeachLink Backend API Documentation')
      .setVersion('1.0')
      .addTag('App')
      .addTag('Quota')
      .addTag('Quota Management')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    // Start server
    const port = process.env.PORT || 3000;
    await app.listen(port);
    
    logger.log(`Server is running on port ${port}`);
    logger.log(`Swagger docs available at http://localhost:${port}/api`);
    
  } catch (error) {
    logger.error('Application failed to start:', error);
    process.exit(1);
  }
}

bootstrap();
