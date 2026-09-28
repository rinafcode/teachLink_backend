import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhookSecurityService } from './webhook-security.service';

/**
 * Guard that validates incoming Stripe webhook requests.
 *
 * Performs:
 * 1. Signature verification using HMAC-SHA256 (against raw body BEFORE parsing)
 * 2. Timestamp freshness validation (±5 minutes)
 * 3. Replay attack prevention (duplicate event ID detection)
 * 4. JSON body parsing with proper error handling (400 on malformed payload)
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

    // Step 1: Verify the Stripe signature against the RAW body FIRST.
    // We use a placeholder event ID for initial signature validation;
    // replay prevention runs after we successfully parse the body.
    const signatureResult = this.webhookSecurityService.verifyStripeSignature(rawBody, signature);

    if (!signatureResult.valid) {
      this.logger.warn(`Stripe webhook rejected: ${signatureResult.reason}`);
      throw new UnauthorizedException(signatureResult.reason);
    }

    // Step 2: Only AFTER signature verification, parse the JSON body.
    // Wrap JSON.parse in try/catch and return 400 for unparseable bodies.
    let eventId: string | undefined;
    try {
      const parsed = JSON.parse(rawBody.toString('utf8'));
      eventId = parsed?.id;
    } catch {
      this.logger.warn('Webhook body is not valid JSON – returning 400');
      throw new BadRequestException('Malformed webhook body: not valid JSON');
    }

    // Step 3: Replay attack prevention using the parsed event ID
    if (this.webhookSecurityService.isReplayAttack(eventId || '')) {
      throw new UnauthorizedException(`Duplicate event: ${eventId}`);
    }

    return true;
  }
}
