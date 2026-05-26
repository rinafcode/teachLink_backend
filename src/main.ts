import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/interceptors/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { correlationMiddleware } from './common/utils/correlation.utils';
import {
  API_VERSION_HEADER,
  DEFAULT_API_VERSION,
  SUPPORTED_API_VERSIONS,
} from './common/interceptors/api-version.interceptor';
import { API_VERSIONING_DOCUMENTATION } from './common/modules/api-versioning.module';
import { sessionConfig } from './config/cache.config';
import { SESSION_REDIS_CLIENT } from './session/session.constants';
import helmet from 'helmet';
import { corsConfig } from './config/cors.config';
import { ShutdownStateService } from './common/services/shutdown-state.service';
import { TIME, BYTES } from './common/constants/time.constants';
import { DecompressionMiddleware } from './common/middleware/decompression.middleware';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const bootstrapStartTime = Date.now();
  const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '1mb';
  const fileUploadMaxBytes = parseInt(
    process.env.FILE_UPLOAD_MAX_BYTES || `${10 * BYTES.ONE_MB_BYTES}`,
    10,
  );

  // Create the application with dynamic module loading
  const app = await NestFactory.create(await AppModule.forRoot(), { rawBody: true });
  const shutdownState = app.get(ShutdownStateService);

  app.enableVersioning({
    type: VersioningType.HEADER,
    header: API_VERSION_HEADER,
    defaultVersion: DEFAULT_API_VERSION,
  });

  // ─── Security Headers ─────────────────────────────────────────────────────
  app.use(
    helmet({
      hsts: {
        maxAge: TIME.ONE_YEAR_SECONDS,
        includeSubDomains: true,
        preload: true,
      },
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  // ─── Request Decompression ────────────────────────────────────────────────
  // Handle compressed request payloads (gzip, brotli, deflate)
  app.use(new DecompressionMiddleware());

  app.use(json({ limit: requestBodyLimit }));
  app.use(urlencoded({ extended: true, limit: requestBodyLimit }));

  app.use((req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.headers['content-type'];
    const contentLengthHeader = req.headers['content-length'];
    const isMultipart =
      typeof contentType === 'string' && contentType.toLowerCase().includes('multipart/form-data');

    if (!isMultipart) {
      next();
      return;
    }

    const contentLengthValue = Array.isArray(contentLengthHeader)
      ? contentLengthHeader[0]
      : contentLengthHeader;
    const contentLength = parseInt(contentLengthValue || '', 10);

    if (!Number.isNaN(contentLength) && contentLength > fileUploadMaxBytes) {
      res.status(413).json({
        message: 'File upload too large',
        maxBytes: fileUploadMaxBytes,
      });
      return;
    }

    next();
  });

  const redisClient = app.get<Redis>(SESSION_REDIS_CLIENT);

  if (sessionConfig.trustProxy) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);
  }

  app.use(correlationMiddleware);

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
