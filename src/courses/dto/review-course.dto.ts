import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReviewDecision } from '../entities/course-review.entity';

/**
 * Payload for an admin/moderator to approve, reject, or request changes on a course.
 */
export class ReviewCourseDto {
  @ApiProperty({
    enum: ReviewDecision,
    description: 'The moderation decision for this course.',
    example: ReviewDecision.APPROVED,
  })
  @IsEnum(ReviewDecision)
  decision: ReviewDecision;

  @ApiProperty({
    description: 'Feedback message sent back to the instructor.',
    required: false,
    example: 'Great course! Approved for publication.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  feedback?: string;
}
