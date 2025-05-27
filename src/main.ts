import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {DocumentBuilder, SwaggerModule} from "@nestjs/swagger"
import { Request, Response, NextFunction } from 'express';
import { ValidationPipe } from '@nestjs/common';


const port = process.env.PORT ?? 3000;
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true
    }
  }))
  /**Swagger Configuration */
  const config = new DocumentBuilder()
    .setTitle('TEACH-LINK-APP  Lerning-App-API')
    .setDescription('Use the base Api URL as http://localhost:3000')
    .setTermsOfService('http://localhost:3000/terms-of-service')
    .addServer('http://localhost:3000')
    .setVersion('1.0')
    .build();


/**instantiate document */
const document = SwaggerModule.createDocument(app, config)
SwaggerModule.setup('api', app, document)

  // app.useGlobalInterceptors(new DataResponseInterceptor)

  // enable cors
  app.enableCors({
    origin: 'http://localhost:3500', // Your frontend URL
    credentials: true, // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed methods
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Set custom headers to avoid COOP issues
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });

  await app.listen(process.env.PORT ?? 3000);
    console.log(`🚀 Swagger is running on: http://localhost:${3000}/api`);
}
bootstrap();