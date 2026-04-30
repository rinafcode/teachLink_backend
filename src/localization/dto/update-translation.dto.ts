import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Defines the update Translation payload.
 */
export class UpdateTranslationDto {
  @ApiPropertyOptional({ example: 'errors' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  namespace?: string;

  @ApiPropertyOptional({ example: 'not_found' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  key?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string;
}
