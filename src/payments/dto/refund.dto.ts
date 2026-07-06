import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsUUID,
  IsDate,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RefundStatus } from '../entities/refund.entity';

export class RefundDto {
  @ApiProperty({
    description: 'Payment ID to refund',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  paymentId: string;

  @ApiProperty({ description: 'Reason for the refund', example: 'Customer requested cancellation' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({
    description: 'Partial refund amount (full refund if omitted)',
    example: 25.0,
  })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ description: 'Refund method', example: 'original_payment' })
  @IsString()
  @IsOptional()
  refundMethod?: string;

  @ApiPropertyOptional({ description: 'Date of refund' })
  @IsOptional()
  @IsDateString()
  @IsDate()
  refundDate?: Date;

  @ApiPropertyOptional({ description: 'Refund status', enum: RefundStatus })
  @IsEnum(RefundStatus)
  @IsOptional()
  status?: RefundStatus;
}
