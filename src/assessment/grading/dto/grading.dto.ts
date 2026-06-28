import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** A single criterion's score within a manual grade payload. */
export class CriterionScoreDto {
  @ApiProperty({ description: 'Criterion ID', format: 'uuid' })
  @IsUUID('4')
  criterionId: string;

  @ApiPropertyOptional({
    description: 'Selected level ID. If omitted, `points` must be supplied directly.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  levelId?: string;

  @ApiPropertyOptional({
    description:
      'Explicit points override (used if `levelId` is omitted, or to award fewer points than the level normally grants). Capped at the criterion `maxPoints`.',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  points?: number;

  @ApiPropertyOptional({ description: 'Optional grader comment for this criterion.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

/**
 * Payload used by an instructor to grade a submission against a rubric.
 */
export class GradeSubmissionDto {
  @ApiProperty({ description: 'Assessment attempt being graded.', format: 'uuid' })
  @IsUUID('4')
  attemptId: string;

  @ApiProperty({ description: 'Rubric to apply.', format: 'uuid' })
  @IsUUID('4')
  rubricId: string;

  @ApiProperty({ type: [CriterionScoreDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one criterion score is required' })
  @ValidateNested({ each: true })
  @Type(() => CriterionScoreDto)
  scores: CriterionScoreDto[];

  @ApiPropertyOptional({ description: 'Optional feedback template to render.' })
  @IsOptional()
  @IsUUID('4')
  feedbackTemplateId?: string;

  @ApiPropertyOptional({
    description: 'Override feedback text. When provided, no template rendering is performed.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  feedbackOverride?: string;
}

/** Payload to trigger automated grading of a submission. */
export class AutoGradeSubmissionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  attemptId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  rubricId: string;

  @ApiPropertyOptional({ description: 'Optional feedback template to render.' })
  @IsOptional()
  @IsUUID('4')
  feedbackTemplateId?: string;
}

/** Create a reusable feedback template. */
export class CreateFeedbackTemplateDto {
  @ApiProperty({ example: 'Standard pass/fail feedback' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(150)
  name: string;

  @ApiProperty({
    description:
      'Template body. Supports placeholders such as {{score}}, {{maxScore}}, {{percentage}}, {{verdict}}, {{rubric}}, {{criterion.<title>}}, {{level.<criterion-title>}}.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10000)
  body: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/** Partial update to a feedback template. */
export class UpdateFeedbackTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
