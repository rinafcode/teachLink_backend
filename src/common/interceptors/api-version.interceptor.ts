import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

export const API_VERSION_HEADER = 'X-API-Version';
export const DEFAULT_API_VERSION = process.env.API_DEFAULT_VERSION || '1';
export const SUPPORTED_API_VERSIONS = (process.env.API_SUPPORTED_VERSIONS || '1')
  .split(',')
  .map((version) => version.trim())
  .filter(Boolean);

@Injectable()
export class ApiVersionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const version = request.headers?.[API_VERSION_HEADER.toLowerCase()] || DEFAULT_API_VERSION;

    if (!SUPPORTED_API_VERSIONS.includes(String(version))) {
      throw new BadRequestException(
        `Unsupported API version "${version}". Supported versions: ${SUPPORTED_API_VERSIONS.join(', ')}`,
      );
    }

    return next.handle();
  }
}
