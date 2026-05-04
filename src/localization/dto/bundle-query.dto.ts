import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Defines the bundle Query payload.
 */
export class BundleQueryDto {
    @ApiProperty({ example: 'errors' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(128)
    namespace: string;
    @ApiPropertyOptional({
        example: 'en',
        description: 'If omitted, uses detected language from middleware / Accept-Language',
    })
    @IsOptional()
    @IsString()
    @MaxLength(32)
    locale?: string;
}
