import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((response) => {
        if (response === null || response === undefined) {
          return response;
        }

        if (Array.isArray(response)) {
          const total = response.length;
          return {
            data: response,
            total,
            page: 1,
            limit: total,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          };
        }

        return response;
      }),
    );
  }
}
