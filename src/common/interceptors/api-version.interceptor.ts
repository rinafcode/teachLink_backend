import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request, Response } from 'express';

export const API_VERSION_HEADER = 'X-API-Version';
export const DEFAULT_API_VERSION = '1';
export const SUPPORTED_API_VERSIONS = ['1'];

export type DeprecatedApiVersion = {
  version: string;
  deprecatedAt: string;
  sunsetAt: string;
  migrationGuide: string;
  message: string;
};

export const DEPRECATED_API_VERSIONS: DeprecatedApiVersion[] = [
  {
    version: '0',
    deprecatedAt: '2025-12-31',
    sunsetAt: '2026-06-30',
    migrationGuide: 'https://docs.teachlink.com/api/versioning#migration-guides',
    message:
      'Version 0 is deprecated and will sunset on 2026-06-30. Upgrade to version 1 using the migration guide.',
  },
];

const VERSION_NEUTRAL_PATHS = ['/health', '/metrics', '/'];

@Injectable()
export class ApiVersionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const headerValue = request.headers[API_VERSION_HEADER.toLowerCase()];
    const apiVersion = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const requestPath = request.path || '/';

    if (!this.isVersionNeutralPath(requestPath) && !apiVersion) {
      throw new HttpException(
        `Missing ${API_VERSION_HEADER} header. Supported versions: ${SUPPORTED_API_VERSIONS.join(', ')}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const resolvedVersion = apiVersion || DEFAULT_API_VERSION;

    if (!this.isVersionNeutralPath(requestPath) && !SUPPORTED_API_VERSIONS.includes(resolvedVersion)) {
      throw new HttpException(
        `Invalid ${API_VERSION_HEADER} header '${resolvedVersion}'. Supported versions: ${SUPPORTED_API_VERSIONS.join(', ')}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const deprecatedVersion = DEPRECATED_API_VERSIONS.find((entry) => entry.version === resolvedVersion);
    if (deprecatedVersion) {
      const sunsetTimestamp = Date.parse(deprecatedVersion.sunsetAt);

      if (!Number.isNaN(sunsetTimestamp) && Date.now() >= sunsetTimestamp) {
        throw new HttpException(
          `API version ${resolvedVersion} has reached end of life on ${deprecatedVersion.sunsetAt}. Please migrate to version ${DEFAULT_API_VERSION}.`,
          HttpStatus.GONE,
        );
      }

      response.setHeader('Deprecation', 'true');
      response.setHeader('Sunset', new Date(deprecatedVersion.sunsetAt).toUTCString());
      response.setHeader(
        'Link',
        `<${deprecatedVersion.migrationGuide}>; rel="migration"; type="text/html"`,
      );
      response.setHeader('X-API-Deprecation-Notice', deprecatedVersion.message);
    }

    if (resolvedVersion) {
      response.setHeader(API_VERSION_HEADER, resolvedVersion);
    }

    return next.handle();
  }

  private isVersionNeutralPath(path: string): boolean {
    return VERSION_NEUTRAL_PATHS.some((neutralPath) => path === neutralPath || path.startsWith(`${neutralPath}/`));
  }
}
