import { IsString, IsOptional, IsArray, IsUUID, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCampaignDto {
    @ApiProperty({ description: 'Campaign name', example: 'Welcome Campaign' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name: string;

    @ApiProperty({ description: 'Email subject line', example: 'Welcome to TeachLink!' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    subject: string;

    @ApiPropertyOptional({ description: 'Preview text shown in inbox' })
    @IsString()
    @IsOptional()
    @MaxLength(255)
    previewText?: string;

    @ApiPropertyOptional({ description: 'Raw HTML content (if not using template)' })
    @IsString()
    @IsOptional()
    content?: string;

    @ApiPropertyOptional({ description: 'Template ID to use' })
    @IsUUID()
    @IsOptional()
    templateId?: string;

    @ApiPropertyOptional({ description: 'Segment IDs to target', type: [String] })
    @IsArray()
    @IsUUID('4', { each: true })
    @IsOptional()
    segmentIds?: string[];
}
