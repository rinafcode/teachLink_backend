import { IsString, IsNumber, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { RefundStatus } from '../entities/refund.entity';

export class RefundDto {
  @IsString()
  paymentId: string;

  @IsString()
  reason: string;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  refundMethod?: string;

  @IsOptional()
  @IsDateString()
  refundDate?: Date;

  @IsEnum(RefundStatus)
  @IsOptional()
  status?: RefundStatus;
}