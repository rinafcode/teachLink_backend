import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { SendGridWebhookEventDto } from './sendgrid-webhook-event.dto';
import { EmailEventType } from '../enums/email-event-type.enum';

describe('SendGridWebhookEventDto', () => {
  it('accepts valid webhook event payloads', async () => {
    const errors = await validate(
      plainToInstance(SendGridWebhookEventDto, {
        email: 'user@example.com',
        event: EmailEventType.DELIVERED,
        reason: 'Delivered successfully',
        custom_args: { campaignId: 'campaign-1' },
        asm: { group_id: 11 },
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it('rejects invalid email addresses', async () => {
    const errors = await validate(
      plainToInstance(SendGridWebhookEventDto, {
        email: 'not-an-email',
        event: EmailEventType.DELIVERED,
      }),
    );

    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('rejects invalid event values', async () => {
    const errors = await validate(
      plainToInstance(SendGridWebhookEventDto, {
        email: 'user@example.com',
        event: 'unknown-event',
      }),
    );

    expect(errors.some((error) => error.property === 'event')).toBe(true);
  });
});
