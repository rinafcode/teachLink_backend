import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cluster from 'node:cluster';
import { cpus } from 'node:os';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import Redis from 'ioredis';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/interceptors/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { correlationMiddleware } from './common/utils/correlation.utils';
import { sessionConfig } from './config/cache.config';
import { SESSION_REDIS_CLIENT } from './session/session.constants';
import helmet from 'helmet';
import { API_VERSIONING_DOCUMENTATION } from './common/modules/api-versioning.module';
import {
  API_VERSION_HEADER,
  DEFAULT_API_VERSION,
  SUPPORTED_API_VERSIONS,
} from './common/interceptors/api-version.interceptor';

async function bootstrapWorker() {
  const logger = new Logger('Bootstrap');
  const bootstrapStartTime = Date.now();

  // Create the application with dynamic module loading
  const app = await NestFactory.create(await AppModule.forRoot(), { rawBody: true });

  app.enableVersioning({
    type: VersioningType.HEADER,
    header: API_VERSION_HEADER,
    defaultVersion: DEFAULT_API_VERSION,
  });

  // ─── Security Headers ─────────────────────────────────────────────────────
  app.use(
    helmet({
      hsts: {
        maxAge: 31536000,
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

  const redisClient = app.get<Redis>(SESSION_REDIS_CLIENT);

  if (sessionConfig.trustProxy) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);
  }

  app.use(correlationMiddleware);

  app.use(
    session({
      store: new RedisStore({
        client: redisClient,
        prefix: sessionConfig.prefix,
        ttl: sessionConfig.ttlSeconds,
      }),
      name: sessionConfig.name,
      secret: sessionConfig.secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        maxAge: sessionConfig.cookieMaxAgeMs,
        httpOnly: true,
        sameSite: 'lax',
        secure: sessionConfig.secureCookies,
      },
    }),
  );

  // ─── Global Exception Filter ──────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ─── Global Logging Interceptor ───────────────────────────────────────────
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ─── Global Response Transform Interceptor ───────────────────────────────
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  // ─── Global Timeout Interceptor ─────────────────────────────────────────
  // TimeoutInterceptor is now provided globally via APP_INTERCEPTOR in AppModule

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
    .setDescription(
      `The TeachLink API documentation - Unified System. ${API_VERSIONING_DOCUMENTATION}`,
    )
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

  const startupTime = Date.now() - bootstrapStartTime;

  if (sessionConfig.stickySessionsRequired) {
    logger.log(
      'Sticky sessions are enabled by policy. Configure LB cookie affinity on teachlink.sid.',
    );
  }

  logger.log(`🚀 TeachLink API running on http://localhost:${port}`);
  logger.log(`📚 Swagger docs available at http://localhost:${port}/api`);
  logger.log(
    `🧭 API versioning enabled via ${API_VERSION_HEADER}. Supported versions: ${SUPPORTED_API_VERSIONS.join(', ')}; default route version: ${DEFAULT_API_VERSION}.`,
  );
  logger.log(`⏱️  Application startup completed in ${startupTime}ms`);
}

async function bootstrap() {
  const logger = new Logger('Cluster');
  const clusterModeEnabled = (process.env.CLUSTER_MODE || 'false') === 'true';

  if (clusterModeEnabled && cluster.isPrimary) {
    const workerCount = parseInt(process.env.CLUSTER_WORKERS || `${cpus().length}`, 10);

    logger.log(`Primary process started in cluster mode with ${workerCount} workers.`);

    for (let i = 0; i < workerCount; i += 1) {
      cluster.fork();
    }

    cluster.on('exit', () => {
      cluster.fork();
    });

    return;
  }

  await bootstrapWorker();
}

bootstrap();
