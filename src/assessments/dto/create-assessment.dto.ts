import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AssessmentType } from '../entities/assessment.entity';
import { CreateQuestionDto } from './create-question.dto';

export class CreateAssessmentDto {
  @ApiProperty({ example: 'JavaScript Fundamentals Quiz' })
  @IsString()
  title: string;

  @ApiProperty({
    example: 'Test your knowledge of JavaScript basics',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: AssessmentType, example: AssessmentType.QUIZ })
  @IsEnum(AssessmentType)
  type: AssessmentType;

  @ApiProperty({ example: 'course-123', required: false })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiProperty({
    example: 30,
    description: 'Time limit in minutes',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  timeLimit?: number;

  @ApiProperty({
    example: 3,
    description: 'Maximum number of attempts allowed',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAttempts?: number;

  @ApiProperty({ example: 70, description: 'Passing score percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passingScore?: number;

  @ApiProperty({ example: false, description: 'Whether to shuffle questions' })
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether to show correct answers after completion',
  })
  @IsOptional()
  @IsBoolean()
  showCorrectAnswers?: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether to allow review of answers',
  })
  @IsOptional()
  @IsBoolean()
  allowReview?: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @ApiProperty({ example: '2024-12-31T23:59:59Z', required: false })
  @IsOptional()
  @IsDateString()
  availableUntil?: string;

  @ApiProperty({ type: [CreateQuestionDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}
