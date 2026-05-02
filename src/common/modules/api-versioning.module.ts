import { BadRequestException, Injectable, MiddlewareConsumer, Module, NestMiddleware, NestModule, NotAcceptableException, RequestMethod, } from '@nestjs/common';
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

/**
 * Registers the api Version Validation module.
 */
@Injectable()
export class ApiVersionValidationMiddleware implements NestMiddleware {
  /**
   * Executes use.
   * @param req The req.
   * @param res The res.
   * @param next The next.
   */
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
}

/**
 * Registers the api Versioning module.
 */
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
  /**
   * Executes configure.
   * @param consumer The consumer.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ApiVersionValidationMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
