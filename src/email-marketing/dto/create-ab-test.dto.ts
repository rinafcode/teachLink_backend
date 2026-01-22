import { IsString, IsArray, IsUUID, IsNotEmpty, IsNumber, IsOptional, ValidateNested, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateABTestVariantDto {
    @ApiPropertyOptional({ description: 'Variant name' })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({ description: 'Subject line for this variant' })
    @IsString()
    @IsOptional()
    subject?: string;

    @ApiPropertyOptional({ description: 'Template ID for this variant' })
    @IsUUID()
    @IsOptional()
    templateId?: string;

    @ApiPropertyOptional({ description: 'Sender name for this variant' })
    @IsString()
    @IsOptional()
    senderName?: string;

    @ApiProperty({ description: 'Traffic weight (percentage)', example: 50 })
    @IsNumber()
    @Min(1)
    @Max(99)
    weight: number;
}

export class CreateABTestDto {
    @ApiProperty({ description: 'Test name', example: 'Subject Line Test' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'Campaign ID to run test on' })
    @IsUUID()
    campaignId: string;

    @ApiProperty({ description: 'Field to test', example: 'subject' })
    @IsString()
    @IsNotEmpty()
    testField: string;

    @ApiPropertyOptional({ description: 'Winner criteria', enum: ['open_rate', 'click_rate'], default: 'open_rate' })
    @IsString()
    @IsOptional()
    winnerCriteria?: string;

    @ApiPropertyOptional({ description: 'Sample size percentage', default: 20 })
    @IsNumber()
    @Min(5)
    @Max(50)
    @IsOptional()
    sampleSize?: number;

    @ApiProperty({ type: [CreateABTestVariantDto], description: 'Test variants (min 2)' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateABTestVariantDto)
    variants: CreateABTestVariantDto[];
}
