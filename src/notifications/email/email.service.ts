import { Injectable } from '@nestjs/common';
import { RetryPolicy } from '../../common/utils/retry-policy';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email through the configured provider (SMTP/SendGrid). Actual
 * transport wiring is injected so this service stays provider-agnostic and
 * testable without a live SMTP connection.
 */
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

@Injectable()
export class EmailService {
  private readonly retryPolicy = new RetryPolicy({ service: 'email' });

  constructor(private readonly provider: EmailProvider) {}

  /**
   * Sends an email, transparently retrying transient provider failures
   * (5xx, network errors) with exponential backoff. 4xx errors (e.g.
   * invalid recipient) propagate immediately.
   */
  async send(message: EmailMessage): Promise<void> {
    await this.retryPolicy.execute(() => this.provider.send(message));
  }
}
