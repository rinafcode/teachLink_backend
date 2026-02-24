import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';


export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  metadata?: Record<string, any>;
}

@Injectable()
export class ResponseTransformInterceptor<T = any>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Exclude file/stream responses (Content-Type or underlying stream)
    const contentType = response.getHeader('Content-Type');
    if (
      response.headersSent ||
      (contentType && (
        contentType.toString().includes('octet-stream') ||
        contentType.toString().includes('application/pdf') ||
        contentType.toString().startsWith('image/') ||
        contentType.toString().startsWith('audio/') ||
        contentType.toString().startsWith('video/')
      ))
    ) {
      // Return as Observable<ApiResponse<T>> by casting, since we skip transformation
      return next.handle() as unknown as Observable<ApiResponse<T>>;
    }

    return next.handle().pipe(
      map((data: any) => {
        // Allow controllers to return { data, message, metadata } for custom messages/metadata
        let message: string | undefined;
        let metadata: Record<string, any> | undefined;
        let responseData = data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          if ('data' in data && typeof data.data !== 'undefined') {
            responseData = data.data;
            message = data.message;
            metadata = data.metadata;
          }
        }
        return {
          success: true,
          message,
          data: responseData,
          metadata,
        };
      })
    );
  }
}
