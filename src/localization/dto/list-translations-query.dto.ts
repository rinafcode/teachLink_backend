import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Defines the list Translations Query payload.
 */
export class ListTranslationsQueryDto {
    @ApiPropertyOptional({ example: 'errors' })
    @IsOptional()
    @IsString()
    @MaxLength(128)
    namespace?: string;
    @ApiPropertyOptional({ example: 'en' })
    @IsOptional()
    @IsString()
    @MaxLength(32)
    locale?: string;
    @ApiPropertyOptional({ description: 'Search substring in key or value' })
    @IsOptional()
    @IsString()
    @MaxLength(256)
    search?: string;
    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;
    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;
}
