import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class LocaleInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Safe fallback
    request.locale = 'en-US';
    request.timezone = 'UTC';

    // If user is authenticated and preferences exist
    if (request.user?.preferences) {
      request.locale = request.user.preferences.locale || 'en-US';
      request.timezone = request.user.preferences.timezone || 'UTC';
    }

    return next.handle();
  }
}