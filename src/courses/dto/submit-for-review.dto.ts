import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * Payload for an instructor to submit a draft course for moderation review.
 */
export class SubmitForReviewDto {
  @ApiProperty({
    description: 'Optional note from the instructor to the reviewer.',
    example: 'This course covers advanced TypeScript patterns.',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  submissionNote?: string;
}
