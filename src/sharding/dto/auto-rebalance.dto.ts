import { IsArray, IsBoolean, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AutoRebalanceDto {
  @ApiProperty({ description: 'Entity types to rebalance', example: ['users', 'courses'] })
  @IsArray()
  @IsString({ each: true })
  entityTypes: string[];

  @ApiProperty({ description: 'Whether to auto-execute the rebalance plan' })
  @IsBoolean()
  autoExecute: boolean;
}
