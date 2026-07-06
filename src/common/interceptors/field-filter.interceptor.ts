import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request } from 'express';

@Injectable()
export class FieldFilterInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const fieldsParam = request.query.fields;

    if (!fieldsParam || typeof fieldsParam !== 'string') {
      return next.handle();
    }

    const requestedFields = fieldsParam.split(',').map((f) => f.trim());
    if (requestedFields.length === 0) {
      return next.handle();
    }

    return next.handle().pipe(map((data) => this.filterData(data, requestedFields)));
  }

  private filterData(data: any, fields: string[]): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.filterObject(item, fields));
    }
    if (data && typeof data === 'object') {
      // If it's a paginated response wrapper (has items/data and meta), filter the array inside
      if (data.items && Array.isArray(data.items)) {
        return {
          ...data,
          items: data.items.map((item: any) => this.filterObject(item, fields)),
        };
      }
      if (data.data && Array.isArray(data.data)) {
        return {
          ...data,
          data: data.data.map((item: any) => this.filterObject(item, fields)),
        };
      }
      return this.filterObject(data, fields);
    }
    return data;
  }

  private filterObject(obj: any, fields: string[]): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const filtered: any = {};
    for (const key of Object.keys(obj)) {
      if (fields.includes(key)) {
        filtered[key] = obj[key];
      }
    }
    return filtered;
  }
}
