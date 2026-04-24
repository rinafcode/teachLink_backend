import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AssessmentType {
  QUIZ = 'quiz',
  EXAM = 'exam',
  ASSIGNMENT = 'assignment',
  PROJECT = 'project',
}

export enum AssessmentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

/**
 * Defines the create Assessment payload.
 */
export class CreateAssessmentDto {
  @ApiProperty({
    description: 'Assessment title',
    example: 'JavaScript Fundamentals Quiz',
  })
  @IsString({ message: 'Title must be a string' })
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @ApiProperty({
    description: 'Assessment description',
    example: 'Test your knowledge of JavaScript basics',
  })
  @IsString({ message: 'Description must be a string' })
  @IsNotEmpty({ message: 'Description is required' })
  description: string;

  @ApiPropertyOptional({
    description: 'Type of assessment',
    enum: AssessmentType,
    default: AssessmentType.QUIZ,
  })
  @IsOptional()
  @IsEnum(AssessmentType, { message: 'Type must be a valid assessment type' })
  type?: AssessmentType;

  @ApiPropertyOptional({
    description: 'Course ID this assessment belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Course ID must be a valid UUID' })
  courseId?: string;

  @ApiPropertyOptional({
    description: 'Maximum score for this assessment',
    example: 100,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max score must be a number' })
  @Min(1, { message: 'Max score must be at least 1' })
  @Max(1000, { message: 'Max score cannot exceed 1000' })
  maxScore?: number;

  @ApiPropertyOptional({
    description: 'Time limit in minutes',
    example: 60,
    minimum: 1,
    maximum: 1440,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Time limit must be a number' })
  @Min(1, { message: 'Time limit must be at least 1 minute' })
  @Max(1440, { message: 'Time limit cannot exceed 24 hours' })
  timeLimitMinutes?: number;

  @ApiPropertyOptional({
    description: 'Whether this assessment is published',
    default: false,
  })
  @IsOptional()
  @IsEnum(AssessmentStatus, { message: 'Status must be a valid assessment status' })
  status?: AssessmentStatus;

  @ApiPropertyOptional({
    description: 'Array of question IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Questions must be an array' })
  @IsUUID('4', { each: true, message: 'Each question ID must be a valid UUID' })
  questionIds?: string[];

  @ApiPropertyOptional({
    description: 'Assessment settings',
    example: {
      allowRetakes: true,
      showCorrectAnswers: false,
      randomizeQuestions: true,
    },
  })
  @IsOptional()
  settings?: Record<string, any>;
}
