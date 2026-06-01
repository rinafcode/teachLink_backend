import { IsNumber, Min } from 'class-validator';

export class RecordCostDto {
  @IsNumber()
  @Min(0)
  amountUsd: number;
}
