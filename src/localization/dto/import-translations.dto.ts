import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Defines the translation Import Row payload.
 */
export class TranslationImportRowDto {
    @ApiProperty({ example: 'errors' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(128)
    namespace: string;
    @ApiProperty({ example: 'not_found' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(512)
    key: string;
    @ApiProperty({ example: 'en' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(32)
    locale: string;
    @ApiProperty({ example: 'Not found.' })
    @IsString()
    @IsNotEmpty()
    value: string;
}
/** Body: `{ "translations": [...] }` or `{ "rows": [...] }` (alias). */
export class ImportTranslationsDto {
    @ApiPropertyOptional({ type: [TranslationImportRowDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TranslationImportRowDto)
    translations?: TranslationImportRowDto[];
    @ApiPropertyOptional({ type: [TranslationImportRowDto], description: 'Alias of translations' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TranslationImportRowDto)
    rows?: TranslationImportRowDto[];
}
