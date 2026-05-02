import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhookSecurityService } from './webhook-security.service';

/**
 * Guard that validates incoming Stripe webhook requests.
 *
 * Performs:
 * 1. Signature verification using HMAC-SHA256
 * 2. Timestamp freshness validation (±5 minutes)
 * 3. Replay attack prevention (duplicate event ID detection)
 *
 * Must be applied to Stripe webhook endpoints.
 */
@Injectable()
export class StripeWebhookGuard implements CanActivate {
  private readonly logger = new Logger(StripeWebhookGuard.name);

  constructor(private readonly webhookSecurityService: WebhookSecurityService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['stripe-signature'] as string;

    if (!signature) {
      this.logger.warn('Webhook request missing stripe-signature header');
      throw new UnauthorizedException('Missing stripe-signature header');
    }

    // Get the raw body for signature verification
    const rawBody = (request as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      this.logger.warn('Webhook request missing raw body');
      throw new UnauthorizedException(
        'Missing raw body – ensure raw body parsing is enabled for this route',
      );
    }

    // Parse event ID from the body for replay prevention.
    // We attempt to parse the JSON to extract the event ID,
    // but we verify the signature against the raw (unparsed) body.
    let eventId: string | undefined;
    try {
      const parsed = JSON.parse(rawBody.toString('utf8'));
      eventId = parsed?.id;
    } catch {
      // If we can't parse, signature verification will still work,
      // but replay prevention will be skipped.
      this.logger.warn('Could not parse webhook body to extract event ID');
    }

    // Run the full verification pipeline
    const result = this.webhookSecurityService.verifyStripeWebhook(rawBody, signature, eventId);

    if (!result.valid) {
      this.logger.warn(`Stripe webhook rejected: ${result.reason}`);
      throw new UnauthorizedException(result.reason);
    }

    return true;
  }
}
