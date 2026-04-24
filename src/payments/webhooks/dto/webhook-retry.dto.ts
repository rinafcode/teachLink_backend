import { IsUUID, IsEnum, IsInt, IsDateString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookStatus, WebhookProvider } from '../entities/webhook-retry.entity';

/**
 * Defines the webhook Retry payload.
 */
export class WebhookRetryDto {
  @ApiProperty({ description: 'Webhook retry ID' })
  @IsUUID()
  id: string;

  @ApiProperty({ enum: WebhookProvider, description: 'Payment provider' })
  @IsEnum(WebhookProvider)
  provider: WebhookProvider;

  @ApiProperty({ description: 'External event ID from provider' })
  externalEventId: string;

  @ApiProperty({ enum: WebhookStatus, description: 'Current webhook status' })
  @IsEnum(WebhookStatus)
  status: WebhookStatus;

  @ApiProperty({ description: 'Number of retry attempts' })
  @IsInt()
  retryCount: number;

  @ApiProperty({ description: 'Maximum number of retries' })
  @IsInt()
  maxRetries: number;

  @ApiPropertyOptional({ description: 'Timestamp of next retry' })
  @IsOptional()
  @IsDateString()
  nextRetryTime?: Date;

  @ApiPropertyOptional({ description: 'Last error message' })
  @IsOptional()
  lastError?: string;

  @ApiPropertyOptional({ description: 'Error details (stack trace, etc.)' })
  @IsOptional()
  @IsObject()
  errorDetails?: Record<string, unknown>;

  @ApiProperty({ description: 'Webhook creation timestamp' })
  @IsDateString()
  createdAt: Date;

  @ApiProperty({ description: 'Webhook last update timestamp' })
  @IsDateString()
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Webhook processing completion timestamp' })
  @IsOptional()
  @IsDateString()
  processedAt?: Date;
}

/**
 * Defines the webhook Retry Response payload.
 */
export class WebhookRetryResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Webhook retry ID' })
  webhookRetryId?: string;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error?: string;
}

/**
 * Defines the dead Letter Webhook payload.
 */
export class DeadLetterWebhookDto extends WebhookRetryDto {
  @ApiProperty({ description: 'Indicates this is a dead letter webhook' })
  isDead: boolean = true;
}
