import { IsString, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty({ description: 'Event category', example: 'feature', maxLength: 64 })
  @IsString()
  @MaxLength(64)
  category: string;

  @ApiProperty({
    description: 'Event action name',
    example: 'launch_button_clicked',
    maxLength: 64,
  })
  @IsString()
  @MaxLength(64)
  action: string;

  @ApiPropertyOptional({
    description: 'Event label for additional context',
    example: 'home_page',
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  label?: string;

  @ApiPropertyOptional({ description: 'Numeric event value', example: 42, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;
}
