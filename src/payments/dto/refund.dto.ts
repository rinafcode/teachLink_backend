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
import { RefundStatus } from '../entities/refund.entity';

/**
 * Defines the refund payload.
 */
export class RefundDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  paymentId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  refundMethod?: string;

  @IsOptional()
  @IsDateString()
  @IsDate()
  refundDate?: Date;

  @IsEnum(RefundStatus)
  @IsOptional()
  status?: RefundStatus;
}
