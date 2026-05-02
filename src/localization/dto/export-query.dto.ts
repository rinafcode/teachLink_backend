import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Defines the export Query payload.
 */
export class ExportQueryDto {
    @ApiProperty({ example: 'errors' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(128)
    namespace: string;
    @ApiPropertyOptional({ example: 'en' })
    @IsOptional()
    @IsString()
    @MaxLength(32)
    locale?: string;
    @ApiPropertyOptional({ enum: ['json', 'csv'], default: 'json' })
    @IsOptional()
    @IsString()
    @IsIn(['json', 'csv'])
    format?: 'json' | 'csv' = 'json';
}
