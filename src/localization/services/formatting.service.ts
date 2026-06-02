import { Injectable } from '@nestjs/common';

@Injectable()
export class FormattingService {
  formatDate(date: Date, locale: string, timeZone: string): string {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  formatCurrency(amount: number, locale: string, currency: string = 'USD'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  }

  formatDateOnly(date: Date, locale: string, timeZone: string): string {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      year: 'numeric',
      month: 'long',
      day: '2-digit',
    }).format(date);
  }
}