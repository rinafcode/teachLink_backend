import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FormattingService } from '../../localization/services/formatting.service';
import { UserPreferenceReaderService } from '../../user-preferences/services/user-preference-reader.service';

@Injectable()
export class ResponseFormatInterceptor implements NestInterceptor {
  constructor(
    private readonly formattingService: FormattingService,
    private readonly preferenceReader: UserPreferenceReaderService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    return next.handle().pipe(
      map(async (data) => {
        if (!userId) return data;

        const prefs = await this.preferenceReader.getByUserId(userId);

        if (!prefs) return data;

        return this.formatResponse(data, prefs.locale, prefs.timezone);
      }),
    );
  }

  private formatResponse(data: any, locale: string, timezone: string): any {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.formatResponse(item, locale, timezone));
    }

    if (typeof data === 'object') {
      const formatted: any = {};

      for (const key in data) {
        const value = data[key];

        if (value instanceof Date) {
          formatted[key] = this.formattingService.formatDate(value, locale as any, timezone);
        } else if (typeof value === 'object') {
          formatted[key] = this.formatResponse(value, locale, timezone);
        } else {
          formatted[key] = value;
        }
      }

      return formatted;
    }

    return data;
  }
}
