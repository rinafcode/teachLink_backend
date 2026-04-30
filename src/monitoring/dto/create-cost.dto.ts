import { IsNumber, Min } from 'class-validator';

export class CreateCostDto {
  @IsNumber()
  @Min(0)
  amountUsd: number;
}
