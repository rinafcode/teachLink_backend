import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  API_VERSION_HEADER,
  DEFAULT_API_VERSION,
  SUPPORTED_API_VERSIONS,
  normalizeRequestedApiVersion,
  isVersionNeutralPath,
} from '../interceptors/api-version.interceptor';

export interface IDeprecationConfig {
  deprecatedVersions: string[];
  sunsetDate?: Date;
  migrationGuide?: string;
}

export const DEPRECATION_CONFIG: IDeprecationConfig = {
  deprecatedVersions: [], // Add versions here when they become deprecated
  sunsetDate: undefined,
  migrationGuide: 'https://docs.teachlink.com/api-versioning',
};

@Injectable()
export class ApiDeprecationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiDeprecationInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();

    const path = request.path || request.url || '/';

    // Skip version-neutral paths
    if (isVersionNeutralPath(path)) {
      return next.handle();
    }

    // Get requested API version
    const requestedVersion =
      request.apiVersion ||
      normalizeRequestedApiVersion(request.headers?.[API_VERSION_HEADER.toLowerCase()]) ||
      DEFAULT_API_VERSION;

    // Check if version is deprecated
    if (DEPRECATION_CONFIG.deprecatedVersions.includes(requestedVersion)) {
      const deprecationMessage = this.buildDeprecationNotice(requestedVersion);
      
      // Set deprecation headers
      response.setHeader('Deprecation', 'true');
      response.setHeader('Sunset', DEPRECATION_CONFIG.sunsetDate?.toISOString() || '');
      response.setHeader('Link', `<${DEPRECATION_CONFIG.migrationGuide}>; rel="deprecation"`);
      response.setHeader('Warning', `299 - "API version ${requestedVersion} is deprecated. ${deprecationMessage}"`);

      this.logger.warn(`Deprecated API version ${requestedVersion} accessed from ${request.ip}`);
    }

    // Add API version to response headers
    response.setHeader(API_VERSION_HEADER, requestedVersion);
    response.setHeader('X-Supported-Versions', SUPPORTED_API_VERSIONS.join(', '));

    return next.handle().pipe(
      tap(() => {
        // Additional post-processing if needed
      }),
    );
  }

  private buildDeprecationNotice(version: string): string {
    const notices: Record<string, string> = {
      '1': `API version ${version} is deprecated. Please migrate to version ${DEFAULT_API_VERSION} or later.`,
    };

    return notices[version] || `API version ${version} is deprecated.`;
  }
}
