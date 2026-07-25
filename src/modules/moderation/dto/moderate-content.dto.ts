import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ModerateContentDto {
  @ApiProperty({ description: 'Content to moderate', maxLength: 10000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;
}
