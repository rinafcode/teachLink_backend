import {
  BadRequestException,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
  NotAcceptableException,
  RequestMethod,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import {
  ApiVersionInterceptor,
  API_VERSION_HEADER,
  API_VERSION_HEADER_KEY,
  DEFAULT_API_VERSION,
  isVersionNeutralPath,
  normalizeRequestedApiVersion,
  SUPPORTED_API_VERSIONS,
  IVersionedRequest,
} from '../interceptors/api-version.interceptor';

export const API_VERSIONING_DOCUMENTATION = [
  'TeachLink uses header-based API versioning.',
  `Send ${API_VERSION_HEADER}: ${DEFAULT_API_VERSION} on versioned endpoints.`,
  `Supported versions: ${SUPPORTED_API_VERSIONS.join(', ')}.`,
  'Health, metrics, root, and webhook endpoints are version-neutral.',
].join(' ');

@Injectable()
export class ApiVersionValidationMiddleware implements NestMiddleware {
  use(
    req: Request & IVersionedRequest & { headers: Record<string, string | string[] | undefined> },
    res: Response,
    next: NextFunction,
  ): void {
    const path = req.path || req.url || '/';

    if (isVersionNeutralPath(path)) {
      req.apiVersion = DEFAULT_API_VERSION;
      next();
      return;
    }

    const rawVersion = req.headers[API_VERSION_HEADER_KEY];
    if (!rawVersion) {
      throw new BadRequestException(
        `Missing required ${API_VERSION_HEADER} header. Supported versions: ${SUPPORTED_API_VERSIONS.join(', ')}`,
      );
    }

    const normalizedVersion = normalizeRequestedApiVersion(rawVersion);
    if (!normalizedVersion) {
      throw new BadRequestException(
        `Invalid ${API_VERSION_HEADER} header value "${Array.isArray(rawVersion) ? rawVersion[0] : rawVersion}". Expected values like "1" or "v1".`,
      );
    }

    if (!SUPPORTED_API_VERSIONS.includes(normalizedVersion)) {
      throw new NotAcceptableException(
        `Unsupported API version "${normalizedVersion}". Supported versions: ${SUPPORTED_API_VERSIONS.join(', ')}`,
      );
    }

    req.headers[API_VERSION_HEADER_KEY] = normalizedVersion;
    req.apiVersion = normalizedVersion;
    res.setHeader(API_VERSION_HEADER, normalizedVersion);
    next();
  }
}

@Module({
  providers: [
    ApiVersionValidationMiddleware,
    ApiVersionInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiVersionInterceptor,
    },
  ],
  exports: [ApiVersionValidationMiddleware, ApiVersionInterceptor],
})
export class ApiVersioningModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ApiVersionValidationMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
