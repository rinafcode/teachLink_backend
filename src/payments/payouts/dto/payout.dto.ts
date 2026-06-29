import { IsString, IsEnum, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum PayoutSchedulePreference {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  INSTANT = 'instant',
}

export class UpdatePayoutSettingsDto {
  @ApiProperty({
    description: 'Payout schedule preference',
    enum: PayoutSchedulePreference,
    example: PayoutSchedulePreference.MONTHLY,
  })
  @IsEnum(PayoutSchedulePreference)
  @IsNotEmpty()
  payoutSchedule: string;

  @ApiProperty({
    description: 'Payout method (e.g. paypal, bank_transfer)',
    example: 'paypal',
  })
  @IsString()
  @IsNotEmpty()
  payoutMethod: string;

  @ApiProperty({
    description: 'PayPal email address or bank details details',
    example: 'instructor@example.com',
  })
  @IsString()
  @IsNotEmpty()
  payoutDetails: string;
}

export class ProcessPayoutDto {
  @ApiProperty({
    description: 'The instructor ID to trigger payout for',
  })
  @IsString()
  @IsNotEmpty()
  instructorId: string;

  @ApiProperty({
    description: 'Payout amount',
    example: 100.0,
  })
  @IsNumber()
  @IsPositive()
  amount: number;
}
