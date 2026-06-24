import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateCohortAssignmentDto {
  @ApiProperty({ example: 'Final project proposal' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Submit a 2-page proposal outlining your final project idea.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '2026-07-15T23:59:59.000Z' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
