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
import { AuditLogService } from './audit-log/audit-log.service';
import { createAuditLoggerMiddleware } from './middleware/audit/audit-logger.middleware';

type SessionRequest = Request & {
  session?: Session & Partial<SessionData> & { userAgent?: string };
};

async function bootstrapWorker(): Promise<void> {
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

  try {
    const auditLogService = app.get(AuditLogService, { strict: false });
    app.use(createAuditLoggerMiddleware(auditLogService));
  } catch {
    logger.warn('AuditLogService not available. Global audit middleware was not registered.');
  }

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

  // Session fixation protection: bind session to User-Agent
  app.use((req: SessionRequest, res: Response, next: NextFunction): void => {
    if (!req.session) {
      next();
      return;
    }

    const userAgent = req.headers['user-agent'] || 'unknown';
    if (!req.session.userAgent) {
      req.session.userAgent = userAgent;
    } else if (req.session.userAgent !== userAgent) {
      req.session.destroy((err: unknown): void => {
        if (err) {
          logger.error('Error destroying session', err);
        }
        res.status(401).json({ message: 'Session invalidation due to fixation protection' });
      });
    }
    next();
  });

  // ─── Global Exception Filter ──────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ─── Global Response Transform Interceptor ───────────────────────────────
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  // ─── Global Timeout Interceptor ─────────────────────────────────────────
  // TimeoutInterceptor is now provided globally via APP_INTERCEPTOR in AppModule

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors(corsConfig);

  // ─── Validation ──────────────────────────────────────────────────────────
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
  app.enableShutdownHooks();
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

  const shutdownTimeoutMs = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10);
  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    shutdownState.markShuttingDown();
    logger.log(`Received ${signal}. Starting graceful shutdown...`);

    const forceExitTimer = setTimeout(() => {
      logger.error(`Graceful shutdown timed out after ${shutdownTimeoutMs}ms. Forcing exit.`);
      process.exit(1);
    }, shutdownTimeoutMs);
    forceExitTimer.unref();

    try {
      await app.close();
      logger.log('Graceful shutdown completed.');
      process.exit(0);
    } catch (error) {
      logger.error(
        'Error during graceful shutdown',
        error instanceof Error ? error.stack : String(error),
      );
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Cluster');
  const clusterModeEnabled = (process.env.CLUSTER_MODE || 'false') === 'true';

  if (clusterModeEnabled && cluster.isPrimary) {
    const workerCount = parseInt(process.env.CLUSTER_WORKERS || `${cpus().length}`, 10);
    const shutdownTimeoutMs = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10);
    let isShuttingDown = false;
    let forceExitTimer: NodeJS.Timeout | undefined;

    logger.log(`Primary process started in cluster mode with ${workerCount} workers.`);

    for (let i = 0; i < workerCount; i += 1) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      if (isShuttingDown) {
        logger.log(
          `Worker ${worker.id} (${worker.process.pid}) exited during shutdown (code: ${code}, signal: ${signal}).`,
        );
        const remainingWorkers = Object.keys(cluster.workers || {}).length;
        if (remainingWorkers === 0) {
          if (forceExitTimer) {
            clearTimeout(forceExitTimer);
          }
          logger.log('All workers have exited. Primary shutting down.');
          process.exit(0);
        }
        return;
      }

      logger.warn(
        `Worker ${worker.id} (${worker.process.pid}) died (code: ${code}, signal: ${signal}). Restarting...`,
      );
      cluster.fork();
    });

    const shutdownCluster = (signal: string): void => {
      if (isShuttingDown) {
        return;
      }

      isShuttingDown = true;
      logger.log(
        `Primary received ${signal}. Shutting down ${Object.keys(cluster.workers || {}).length} workers...`,
      );

      forceExitTimer = setTimeout(() => {
        logger.error(`Cluster shutdown timed out after ${shutdownTimeoutMs}ms. Forcing exit.`);
        for (const id in cluster.workers) {
          const worker = cluster.workers[id];
          if (worker && !worker.isDead()) {
            worker.process.kill('SIGKILL');
          }
        }
        process.exit(1);
      }, shutdownTimeoutMs);
      forceExitTimer.unref();

      for (const id in cluster.workers) {
        const worker = cluster.workers[id];
        if (worker) {
          worker.process.kill(signal as NodeJS.Signals);
        }
      }
    };

    process.on('SIGTERM', () => {
      shutdownCluster('SIGTERM');
    });
    process.on('SIGINT', () => {
      shutdownCluster('SIGINT');
    });

    return;
  }

  await bootstrapWorker();
}

void bootstrap();
