import { IsString, IsOptional, IsArray, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemplateDto {
    @ApiProperty({ description: 'Template name', example: 'Welcome Email' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name: string;

    @ApiProperty({ description: 'Email subject with variables', example: 'Welcome, {{firstName}}!' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    subject: string;

    @ApiProperty({ description: 'HTML content with Handlebars variables' })
    @IsString()
    @IsNotEmpty()
    htmlContent: string;

    @ApiPropertyOptional({ description: 'Plain text version' })
    @IsString()
    @IsOptional()
    textContent?: string;

    @ApiPropertyOptional({ description: 'Category for organization' })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    category?: string;
}
