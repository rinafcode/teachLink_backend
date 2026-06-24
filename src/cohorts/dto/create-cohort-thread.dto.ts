import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCohortThreadDto {
  @ApiProperty({ example: 'Week 1 Discussion' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'What concepts did you find most challenging in the first module?' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
