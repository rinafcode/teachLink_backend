import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EmailEventType } from '../enums/email-event-type.enum';

/**
 * Representation of a single SendGrid webhook event.
 */
export class SendGridWebhookEventDto {
  @ApiProperty({
    description: 'Email address affected by the webhook event.',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @ApiProperty({
    description: 'SendGrid event type.',
    example: EmailEventType.DELIVERED,
    enum: EmailEventType,
  })
  @IsEnum(EmailEventType, { message: 'Event must be a valid SendGrid event type' })
  event: EmailEventType;

  @ApiPropertyOptional({
    description: 'Optional reason or failure message associated with bounce or spam events.',
    example: 'Mailbox does not exist',
  })
  @IsOptional()
  @IsString({ message: 'Reason must be a string' })
  reason?: string;

  @ApiPropertyOptional({
    description: 'Optional SendGrid custom arguments passed through the webhook.',
    example: { campaignId: 'campaign-1' },
  })
  @IsOptional()
  @IsObject({ message: 'Custom args must be an object' })
  custom_args?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Optional SendGrid ASM metadata object.',
    example: { group_id: 123 },
  })
  @IsOptional()
  @IsObject({ message: 'ASM metadata must be an object' })
  asm?: Record<string, unknown>;
}

/**
 * Root payload wrapper for SendGrid webhook events.
 */
export class SendGridWebhookPayloadDto {
  @ApiProperty({
    description: 'Array of webhook event objects sent by SendGrid.',
    type: [SendGridWebhookEventDto],
  })
  @IsArray({ message: 'Events must be an array' })
  @ValidateNested({ each: true })
  @Type(() => SendGridWebhookEventDto)
  events: SendGridWebhookEventDto[];
}
