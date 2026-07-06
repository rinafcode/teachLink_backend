import { Injectable } from '@nestjs/common';

@Injectable()
export class LocaleFormatService {
  formatDate(date: Date, locale: string, timezone: string): string {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }

  formatCurrency(amount: number, locale: string, currency = 'USD'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  }
}
