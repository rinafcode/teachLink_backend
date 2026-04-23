import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface ApiVersion {
  major: number;
  minor: number;
  string: string;
}

export interface VersionedRequest {
  apiVersion: ApiVersion;
}

/**
 * API Version Interceptor
 * Extracts version from URL path or header and attaches to request
 */
@Injectable()
export class ApiVersionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiVersionInterceptor.name);

  // Supported API versions
  readonly supportedVersions: ApiVersion[] = [
    { major: 1, minor: 0, string: 'v1' },
    { major: 2, minor: 0, string: 'v2' },
  ];

  // Default version if none specified
  readonly defaultVersion: ApiVersion = { major: 1, minor: 0, string: 'v1' };

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const version = this.extractVersion(request);

    // Attach version to request
    (request as VersionedRequest).apiVersion = version;

    this.logger.debug(`API Version: ${version.string} for ${request.method} ${request.url}`);

    return next.handle().pipe(
      tap(() => {
        // Add version header to response
        const response = context.switchToHttp().getResponse();
        response.setHeader('X-API-Version', version.string);
      }),
    );
  }

  /**
   * Extract version from request
   * Priority: URL path > Header > Query param > Default
   */
  private extractVersion(request: any): ApiVersion {
    // 1. Check URL path for version (e.g., /api/v1/users)
    const pathVersion = this.extractFromPath(request.path || request.url);
    if (pathVersion) {
      return pathVersion;
    }

    // 2. Check Accept header (e.g., Accept: application/vnd.teachlink.v1+json)
    const acceptHeader = request.headers?.accept || request.headers?.['accept'];
    if (acceptHeader) {
      const headerVersion = this.extractFromAcceptHeader(acceptHeader);
      if (headerVersion) {
        return headerVersion;
      }
    }

    // 3. Check custom header (e.g., X-API-Version: v1)
    const customHeader = request.headers?.['x-api-version'];
    if (customHeader) {
      const headerVersion = this.parseVersionString(customHeader);
      if (headerVersion && this.isSupported(headerVersion)) {
        return headerVersion;
      }
    }

    // 4. Check query parameter (e.g., ?version=v1)
    const queryVersion = request.query?.version;
    if (queryVersion) {
      const parsed = this.parseVersionString(queryVersion);
      if (parsed && this.isSupported(parsed)) {
        return parsed;
      }
    }

    // Return default version
    return this.defaultVersion;
  }

  /**
   * Extract version from URL path
   */
  private extractFromPath(path: string): ApiVersion | null {
    if (!path) return null;

    // Match /api/v1 or /v1 patterns
    const match = path.match(/[/]v(\d+)(?:\.(\d+))?[/]/);
    if (match) {
      const version: ApiVersion = {
        major: parseInt(match[1], 10),
        minor: match[2] ? parseInt(match[2], 10) : 0,
        string: `v${match[1]}${match[2] ? `.${match[2]}` : ''}`,
      };
      if (this.isSupported(version)) {
        return version;
      }
    }

    return null;
  }

  /**
   * Extract version from Accept header
   */
  private extractFromAcceptHeader(acceptHeader: string): ApiVersion | null {
    // Match application/vnd.teachlink.v1+json or similar
    const match = acceptHeader.match(/v(\d+)(?:\.(\d+))?/);
    if (match) {
      const version: ApiVersion = {
        major: parseInt(match[1], 10),
        minor: match[2] ? parseInt(match[2], 10) : 0,
        string: `v${match[1]}${match[2] ? `.${match[2]}` : ''}`,
      };
      if (this.isSupported(version)) {
        return version;
      }
    }

    return null;
  }

  /**
   * Parse version string to ApiVersion
   */
  private parseVersionString(version: string): ApiVersion | null {
    if (!version) return null;

    // Handle v1, v1.0, v2, v2.1 formats
    const match = version.match(/^v?(\d+)(?:\.(\d+))?$/);
    if (match) {
      return {
        major: parseInt(match[1], 10),
        minor: match[2] ? parseInt(match[2], 10) : 0,
        string: `v${match[1]}${match[2] ? `.${match[2]}` : ''}`,
      };
    }

    return null;
  }

  /**
   * Check if version is supported
   */
  private isSupported(version: ApiVersion): boolean {
    return this.supportedVersions.some(
      (v) => v.major === version.major && v.minor === version.minor,
    );
  }

  /**
   * Get supported versions for documentation
   */
  getSupportedVersions(): string[] {
    return this.supportedVersions.map((v) => v.string);
  }
}

/**
 * Guard to enforce API versioning
 */
@Injectable()
export class ApiVersionGuard {
  private readonly logger = new Logger(ApiVersionGuard.name);
  private readonly supportedVersions = ['v1', 'v2'];

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const version = (request as VersionedRequest).apiVersion;

    if (!version || !this.supportedVersions.includes(version.string)) {
      this.logger.warn(`Unsupported API version: ${version?.string}`);
      return false;
    }

    return true;
  }
}

/**
 * Decorator for version-specific endpoints
 */
export function ApiVersion(version: string): MethodDecorator {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata('api:version', version, descriptor.value);
    return descriptor;
  };
}

/**
 * Decorator to get the current API version from request
 */
export function GetApiVersion(): ParameterDecorator {
  return function (_target: object, _propertyKey: string | symbol, _parameterIndex: number) {
    // This will be handled by the interceptor to inject the version
  };
}
