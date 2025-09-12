import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartAssessmentDto {
  @ApiProperty({ example: 'assessment-123' })
  @IsString()
  @IsNotEmpty()
  assessmentId: string;
}
