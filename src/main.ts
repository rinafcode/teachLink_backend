import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cluster from 'node:cluster';
import { cpus } from 'node:os';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';
import session, { type Session, type SessionData } from 'express-session';
import { RedisStore } from 'connect-redis';
import Redis from 'ioredis';

import { AppModule } from './app.module';
import * as OpenApiValidator from 'express-openapi-validator';
import { join } from 'path';
import './tracing/opentelemetry';

import { CorrelationIdMiddleware } from './middleware/correlation-id';
import { createSessionConfig } from './config/cache.config';
import { SESSION_REDIS_CLIENT } from './session/session.constants';
import helmet from 'helmet';
import { corsConfig } from './config/cors.config';
import { ShutdownStateService } from './common/services/shutdown-state.service';
import { GracefulShutdownService } from './common/services/graceful-shutdown.service';
import { RequestTrackerService } from './common/services/request-tracker.service';
import { DatabaseShutdownService } from './database/services/database-shutdown.service';
import { WorkerShutdownService } from './workers/services/worker-shutdown.service';
import { TIME, BYTES } from './common/constants/time.constants';
import { DecompressionMiddleware } from './common/middleware/decompression.middleware';
import { csrfMiddleware } from './middleware/csrf/csrf.middleware';
import { SlackService } from './slack.service';
import compression from 'compression';
import { AuditLogService } from './audit-log/audit-log.service';
import { createAuditLoggerMiddleware } from './middleware/audit/audit-logger.middleware';
import { initStructuredLogging } from './logging/structured-logging';
import { requestIdMiddleware } from './logging/request-id.middleware';

// GLOBAL ENFORCEMENT IMPORT (IMPORTANT FOR YOUR TASK)
import { LocaleInterceptor } from './common/interceptors/locale.interceptor';
import { PaginationInterceptor } from './common/interceptors/pagination.interceptor';

const API_VERSION_HEADER = 'X-API-Version';
const DEFAULT_API_VERSION = '1';
// const SUPPORTED_API_VERSIONS = ['1'];

type SessionRequest = Request & {
  session?: Session & Partial<SessionData> & { userAgent?: string };
};

async function bootstrapWorker(): Promise<void> {
  initStructuredLogging(process.env.SERVICE_NAME || 'teachlink-backend');
  const logger = new Logger('Bootstrap');
  const bootstrapStartTime = Date.now();

  const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '1mb';

  const fileUploadMaxBytes = parseInt(
    process.env.FILE_UPLOAD_MAX_BYTES || `${10 * BYTES.ONE_MB_BYTES}`,
    10,
  );

  const wsMaxPayloadBytes = parseInt(
    process.env.WS_MAX_PAYLOAD_BYTES || `${BYTES.SIXTY_FOUR_KB}`,
    10,
  );

  const app = await NestFactory.create(AppModule, { rawBody: true });

  // =========================
  // WEBSOCKET PAYLOAD SIZE LIMIT
  // =========================
  // Configure Socket.IO maxHttpBufferSize at the transport layer.
  // Messages exceeding this limit are rejected before reaching any handler.
  const { IoAdapter } = await import('@nestjs/platform-socket.io');

  class SizeLimitedIoAdapter extends IoAdapter {
    createIOServer(port: number, options?: any): any {
      return super.createIOServer(port, {
        ...options,
        maxHttpBufferSize: wsMaxPayloadBytes,
      });
    }
  }

  app.useWebSocketAdapter(new SizeLimitedIoAdapter(app));
  logger.log(
    `WebSocket maxHttpBufferSize set to ${wsMaxPayloadBytes} bytes (${Math.round(wsMaxPayloadBytes / 1024)}KB)`,
  );

  // Get shutdown services
  const shutdownState = app.get(ShutdownStateService);
  const gracefulShutdown = app.get(GracefulShutdownService);
  const requestTracker = app.get(RequestTrackerService);
  const databaseShutdown = app.get(DatabaseShutdownService);
  const workerShutdown = app.get(WorkerShutdownService);

  // Register shutdown phases
  gracefulShutdown.registerShutdownPhase({
    name: 'stop-accepting-requests',
    timeout: 5000,
    execute: async () => {
      logger.log('Phase 1: Stopping new request acceptance...');
      shutdownState.markShuttingDown('Graceful shutdown initiated');
    },
  });

  gracefulShutdown.registerShutdownPhase({
    name: 'complete-active-requests',
    timeout: 15000,
    execute: async () => {
      logger.log('Phase 2: Waiting for active requests to complete...');
      await requestTracker.waitForActiveRequests(12000);
    },
  });

  gracefulShutdown.registerShutdownPhase({
    name: 'shutdown-workers',
    timeout: 20000,
    execute: async () => {
      logger.log('Phase 3: Shutting down workers and completing jobs...');
      await workerShutdown.shutdown();
    },
  });

  gracefulShutdown.registerShutdownPhase({
    name: 'shutdown-database',
    timeout: 15000,
    execute: async () => {
      logger.log('Phase 4: Shutting down database connections...');
      await databaseShutdown.shutdown();
    },
  });

  gracefulShutdown.registerShutdownPhase({
    name: 'close-application',
    timeout: 5000,
    execute: async () => {
      logger.log('Phase 5: Closing NestJS application...');
      await app.close();
    },
  });

  // =========================
  // API VERSIONING
  // =========================
  app.enableVersioning({
    type: VersioningType.HEADER,
    header: API_VERSION_HEADER,
    defaultVersion: DEFAULT_API_VERSION,
  });

  // =========================
  // SECURITY
  // =========================
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

  app.use(new DecompressionMiddleware());
  app.use(
    compression({
      threshold: 1024, // Only compress responses >1KB (1024 bytes)
      level: 6, // Default gzip compression level (balance between speed and compression)
      filter: (req: Request, _res: Response) => {
        // Only compress if the client accepts gzip encoding
        const acceptEncoding = req.headers['accept-encoding'] || '';
        return acceptEncoding.includes('gzip');
      },
    }),
  );

  // =========================
  // BODY PARSING
  // =========================
  const requestBodyLimitBytes = requestBodyLimit;

  app.use(json({ limit: requestBodyLimitBytes }));
  app.use(urlencoded({ extended: true, limit: requestBodyLimitBytes }));

  // =========================
  // FILE SIZE GUARD
  // =========================
  app.use((req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.headers['content-type'];
    const contentLengthHeader = req.headers['content-length'];

    const isMultipart =
      typeof contentType === 'string' && contentType.toLowerCase().includes('multipart/form-data');

    if (!isMultipart) return next();

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

  // =========================
  // REDIS SESSION
  // =========================
  const redisClient = app.get<Redis>(SESSION_REDIS_CLIENT);
  const sessionConfig = createSessionConfig();

  if (sessionConfig.trustProxy) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);
  }

  const correlationIdMiddleware = new CorrelationIdMiddleware();
  app.use(correlationIdMiddleware.use.bind(correlationIdMiddleware));
  app.use(requestIdMiddleware);

  const auditLogService = app.get(AuditLogService);
  app.use(createAuditLoggerMiddleware(auditLogService));

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
        sameSite: 'strict',
        secure: true,
      },
    }),
  );

  // =========================
  // SESSION FIXATION PROTECTION
  // =========================
  app.use((req: SessionRequest, res: Response, next: NextFunction): void => {
    if (!req.session) return next();

    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!req.session.userAgent) {
      req.session.userAgent = userAgent;
    } else if (req.session.userAgent !== userAgent) {
      req.session.destroy((err: unknown): void => {
        if (err) logger.error('Error destroying session', err);
        res.status(401).json({
          message: 'Session invalidation due to fixation protection',
        });
      });
      return;
    }

    next();
  });

  // =========================
  // CSRF PROTECTION
  // =========================
  app.use(csrfMiddleware);

  // =========================
  // CORS
  // =========================
  app.enableCors(corsConfig);

  // =========================
  // GLOBAL PIPE
  // =========================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      stopAtFirstError: true,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // =========================
  // GLOBAL TIMEZONE + LOCALE ENFORCEMENT (IMPORTANT FIX)
  // =========================
  app.useGlobalInterceptors(new LocaleInterceptor(), new PaginationInterceptor());

  // =========================
  // OPENAPI VALIDATION
  // =========================
  const apiSpecPath = join(process.cwd(), 'docs/api/openapi-spec.json');
  app.use(
    OpenApiValidator.middleware({
      apiSpec: apiSpecPath,
      validateRequests: true,
      validateResponses: process.env.NODE_ENV !== 'production',
      ignorePaths: /.*\/api\/docs.*/, // ignore swagger docs
    }),
  );

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err.status === 400 && err.errors) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: err.errors.map((e: any) => ({
          field: e.path,
          message: e.message,
        })),
      });
    }
    if (
      err.status === 500 &&
      err.errors &&
      typeof err.message === 'string' &&
      err.message.toLowerCase().includes('response')
    ) {
      logger.warn(`Response validation deviation: ${JSON.stringify(err.errors)}`);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
    next(err);
  });

  // =========================
  // SWAGGER
  // =========================
  const config = new DocumentBuilder()
    .setTitle('TeachLink API')
    .setDescription('The TeachLink API documentation - Unified System.')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('gamification', 'Gamification and user rewards')
    .addTag('Email Marketing - Campaigns', 'Create and manage email campaigns')
    .addTag('Email Marketing - Templates', 'Email template management')
    .addTag('Email Marketing - Automation', 'Automation workflows')
    .addTag('Email Marketing - Segments', 'Audience segmentation')
    .addTag('Email Marketing - A/B Testing', 'A/B testing for campaigns')
    .addTag('Email Marketing - Analytics', 'Campaign analytics and reporting')
    .addTag('moderation', 'User reports and moderation queue')
    .addTag('App')
    .addTag('Quota')
    .addTag('Quota Management')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
    jsonDocumentUrl: 'api/docs-json',
  });

  // =========================
  // START SERVER
  // =========================
  const port = process.env.PORT || 3000;

  app.enableShutdownHooks();
  const slackService = app.get(SlackService);
  await slackService.sendAlert(
    'TeachLink Backend has successfully started up on local system! 🚀',
    'low',
  );
  await app.listen(port);

  const startupTime = Date.now() - bootstrapStartTime;

  logger.log(`TeachLink API running on http://localhost:${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  logger.log(`Startup completed in ${startupTime}ms`);

  // =========================
  // SHUTDOWN HANDLER
  // =========================
  const shutdownTimeoutMs = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10);
  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return;

    isShuttingDown = true;
    shutdownState.markShuttingDown();

    logger.log(`Received ${signal}. Starting graceful shutdown...`);

    const timer = setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, shutdownTimeoutMs);

    timer.unref();

    try {
      await gracefulShutdown.shutdown(signal);
      logger.log('Graceful shutdown completed.');
      process.exit(0);
    } catch (err) {
      logger.error('Shutdown error', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Cluster');
  const clusterModeEnabled = (process.env.CLUSTER_MODE || 'false') === 'true';

  if (clusterModeEnabled && cluster.isPrimary) {
    const workerCount = parseInt(process.env.CLUSTER_WORKERS || `${cpus().length}`, 10);

    logger.log(`Cluster mode enabled with ${workerCount} workers`);

    for (let i = 0; i < workerCount; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker) => {
      logger.warn(`Worker ${worker.process.pid} died. Restarting...`);
      cluster.fork();
    });

    return;
  }

  await bootstrapWorker();
}

void bootstrap();
