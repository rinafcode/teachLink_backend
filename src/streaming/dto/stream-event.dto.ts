import { IsString, IsNotEmpty, IsOptional, IsObject, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Base DTO for stream event metadata
 */
export class StreamEventMetadataDto {
  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsObject()
  additionalInfo?: Record<string, any>;
}

/**
 * Base DTO for stream events
 */
export class StreamEventDto<T = any> {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsNumber()
  timestamp: number;

  @IsNotEmpty()
  data: T;

  @IsOptional()
  @ValidateNested()
  @Type(() => StreamEventMetadataDto)
  metadata?: StreamEventMetadataDto;
}

/**
 * DTO for publishing events to the stream
 */
export class PublishEventDto<T = any> extends StreamEventDto<T> {}

/**
 * DTO for stream subscription request
 */
export class StreamSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @IsOptional()
  @IsString()
  clientId?: string;
}

/**
 * DTO for stream subscription response
 */
export class StreamSubscriptionResponseDto {
  @IsString()
  @IsNotEmpty()
  subscriptionId: string;

  @IsString()
  @IsNotEmpty()
  eventType: string;

  @IsString()
  @IsNotEmpty()
  status: 'active' | 'pending' | 'error';

  @IsOptional()
  @IsString()
  message?: string;
}