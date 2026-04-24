import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

export const API_VERSION_HEADER = process.env.API_VERSION_HEADER_NAME?.trim() || 'X-API-Version';
export const API_VERSION_HEADER_KEY = API_VERSION_HEADER.toLowerCase();

export interface ApiVersion {
  major: number;
  minor: number;
  string: string;
}

export function normalizeRequestedApiVersion(version?: string | string[]): string | null {
  if (!version) {
    return null;
  }

  const raw = Array.isArray(version) ? version[0] : version;
  const trimmed = raw.trim();
  const match = trimmed.match(/^v?(\d+)(?:\.0+)?$/i);

  if (!match) {
    return null;
  }

  return match[1];
}

export function normalizeConfiguredVersion(version: string): string {
  const normalized = normalizeRequestedApiVersion(version);
  return normalized || '1';
}

export const DEFAULT_API_VERSION = normalizeConfiguredVersion(
  process.env.API_DEFAULT_VERSION?.trim() || '1',
);

export function parseSupportedApiVersions(raw = process.env.API_SUPPORTED_VERSIONS): string[] {
  const configured = raw?.trim() ? raw : DEFAULT_API_VERSION;
  const versions = configured
    .split(',')
    .map((version) => normalizeRequestedApiVersion(version))
    .filter((version): version is string => Boolean(version));

  if (!versions.length) {
    return [DEFAULT_API_VERSION];
  }

  return Array.from(new Set(versions));
}

export const SUPPORTED_API_VERSIONS = parseSupportedApiVersions(process.env.API_SUPPORTED_VERSIONS);

const VERSION_NEUTRAL_PATH_PREFIXES = ['/api', '/health', '/metrics', '/webhooks'];
const VERSION_NEUTRAL_EXACT_PATHS = ['/', '/api-json', '/favicon.ico'];

export interface VersionedRequest {
  apiVersion?: string;
}

export function isVersionNeutralPath(pathOrUrl: string): boolean {
  const path = (pathOrUrl || '/').split('?')[0];

  if (VERSION_NEUTRAL_EXACT_PATHS.includes(path)) {
    return true;
  }

  return VERSION_NEUTRAL_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

@Injectable()
export class ApiVersionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiVersionInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<VersionedRequest & { headers?: Record<string, string> }>();
    const response = http.getResponse<{ setHeader: (name: string, value: string) => void }>();

    const resolvedVersion =
      request.apiVersion || request.headers?.[API_VERSION_HEADER_KEY] || DEFAULT_API_VERSION;

    request.apiVersion = resolvedVersion;

    if (!isVersionNeutralPath((request as any).path || '')) {
      response.setHeader(API_VERSION_HEADER, resolvedVersion);
    }

    return next.handle();
  }
}

/**
 * Decorator to get the current API version from request
 */
export function GetApiVersion(): ParameterDecorator {
  return function (_target: object, _propertyKey: string | symbol, _parameterIndex: number) {
    // This will be handled by the interceptor to inject the version
  };
}
