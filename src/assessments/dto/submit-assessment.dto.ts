import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitAssessmentDto {
  @ApiProperty({ example: 'attempt-123' })
  @IsString()
  @IsNotEmpty()
  attemptId: string;

  @ApiProperty({
    example: {
      'question-1': 'option-a',
      'question-2': true,
      'question-3': 'console.log("Hello World");',
    },
    description: 'Map of questionId to user answers',
  })
  @IsObject()
  answers: Record<string, any>;
}
