import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
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

/** Performance level on a criterion. */
export class CreateRubricLevelDto {
  @ApiProperty({ example: 'Excellent' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @ApiPropertyOptional({ description: 'Long-form description of this level.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ minimum: 0, example: 4 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  points: number;

  @ApiPropertyOptional({ description: 'Display order (lowest first).', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

/** A single rubric criterion plus its levels. */
export class CreateRubricCriterionDto {
  @ApiProperty({ example: 'Code quality' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ minimum: 0, example: 4 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxPoints: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  /**
   * Index (within `levels`) of the level used when auto-grading.
   * When provided on every criterion, the rubric becomes auto-gradeable.
   */
  @ApiPropertyOptional({
    description: 'Zero-based index into `levels` to use as the default for auto-grading.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultLevelIndex?: number;

  @ApiProperty({ type: [CreateRubricLevelDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'A criterion must have at least one level' })
  @ValidateNested({ each: true })
  @Type(() => CreateRubricLevelDto)
  levels: CreateRubricLevelDto[];
}

/**
 * Payload to create a brand-new rubric (criteria + levels in one go).
 */
export class CreateRubricDto {
  @ApiProperty({ example: 'Final project rubric' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ description: 'Optional assessment binding.' })
  @IsOptional()
  @IsUUID('4')
  assessmentId?: string;

  @ApiPropertyOptional({
    description:
      'When true, every criterion must define `defaultLevelIndex`; otherwise the request is rejected.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoGradeEnabled?: boolean;

  @ApiProperty({ type: [CreateRubricCriterionDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'A rubric must have at least one criterion' })
  @ValidateNested({ each: true })
  @Type(() => CreateRubricCriterionDto)
  criteria: CreateRubricCriterionDto[];
}

/** Partial rubric update (name/description/assessment binding only). */
export class UpdateRubricDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  assessmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoGradeEnabled?: boolean;
}
