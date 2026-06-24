import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecordCostDto {
  @ApiProperty({ description: 'Cost amount in USD', example: 5.0, minimum: 0 })
  @IsNumber()
  @Min(0)
  amountUsd: number;
}
