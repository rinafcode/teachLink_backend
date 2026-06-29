import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

/**
 * Single answer payload for an assessment submission.
 */
export class AssessmentAnswerDto {
  @ApiProperty({
    description: 'Unique identifier for the question being answered.',
    example: 'question-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString({ message: 'Question ID must be a string' })
  @IsNotEmpty({ message: 'Question ID is required' })
  questionId: string;

  @ApiProperty({
    description:
      'Answer payload for the question. This can be text, choice IDs or structured data depending on question type.',
    example: 'B',
  })
  @IsNotEmpty({ message: 'Answer is required' })
  answer: unknown;
}

/**
 * Request body for submitting assessment answers.
 */
export class SubmitAssessmentDto {
  @ApiProperty({
    description: 'Array of answers submitted for the assessment attempt.',
    type: [AssessmentAnswerDto],
  })
  @IsArray({ message: 'Answers must be an array' })
  @ValidateNested({ each: true })
  @Type(() => AssessmentAnswerDto)
  answers: AssessmentAnswerDto[];
}
