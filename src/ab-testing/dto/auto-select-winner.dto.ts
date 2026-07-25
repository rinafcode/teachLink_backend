import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * Request DTO for auto-selecting a winning experiment variant.
 */
export class AutoSelectWinnerDto {
  @ApiPropertyOptional({
    description: 'Minimum number of votes required before picking a winner.',
    example: 100,
  })
  @IsOptional()
  @IsInt({ message: 'Minimum votes must be an integer' })
  @Min(1, { message: 'Minimum votes must be at least 1' })
  minimumVotes?: number;

  @ApiPropertyOptional({
    description: 'Minimum number of days the experiment must run before selecting a winner.',
    example: 3,
  })
  @IsOptional()
  @IsInt({ message: 'Minimum duration days must be an integer' })
  @Min(1, { message: 'Minimum duration must be at least 1 day' })
  minimumDurationDays?: number;
}
