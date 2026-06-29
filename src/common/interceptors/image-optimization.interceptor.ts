import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ImageOptimizationInterceptor implements NestInterceptor {
  private readonly imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Optionally only apply image optimization for mobile user agents
    // if (/Mobile|Android|iPhone/i.test(userAgent)) { ... }

    return next.handle().pipe(map((data) => this.optimizeImages(data)));
  }

  private optimizeImages(data: any): any {
    if (typeof data === 'string') {
      return this.appendOptimizationParams(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.optimizeImages(item));
    }

    if (data && typeof data === 'object') {
      const optimized: any = {};
      for (const key of Object.keys(data)) {
        optimized[key] = this.optimizeImages(data[key]);
      }
      return optimized;
    }

    return data;
  }

  private appendOptimizationParams(url: string): string {
    if (!url || typeof url !== 'string') return url;

    try {
      const lowerUrl = url.toLowerCase();
      const isImage = this.imageExtensions.some((ext) => lowerUrl.includes(ext));

      if (isImage && url.startsWith('http')) {
        const urlObj = new URL(url);
        // Do not double-append if params already exist
        if (!urlObj.searchParams.has('w')) {
          urlObj.searchParams.set('w', '400');
          urlObj.searchParams.set('q', '75');
          urlObj.searchParams.set('fmt', 'webp');
          return urlObj.toString();
        }
      }
    } catch (_e) {
      // Ignore parsing errors and return original URL
    }

    return url;
  }
}
