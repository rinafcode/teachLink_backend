import { IsString, IsOptional, IsArray, IsBoolean, IsNotEmpty, ValidateNested, IsEnum, } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SegmentRuleField } from '../enums/segment-rule-field.enum';
import { SegmentRuleOperator } from '../enums/segment-rule-operator.enum';
export class CreateSegmentRuleDto {
    @ApiProperty({ enum: SegmentRuleField, example: 'email' })
    @IsEnum(SegmentRuleField)
    @IsNotEmpty()
    field: SegmentRuleField;
    @ApiProperty({ enum: SegmentRuleOperator, example: 'contains' })
    @IsEnum(SegmentRuleOperator)
    @IsNotEmpty()
    operator: SegmentRuleOperator;
    @ApiProperty({ description: 'Rule value', example: 'gmail.com' })
    @IsNotEmpty()
    value: unknown;
    @ApiPropertyOptional({ enum: ['AND', 'OR'], default: 'AND' })
    @IsOptional()
    @IsString()
    logicalOperator?: 'AND' | 'OR';
}
export class CreateSegmentDto {
    @ApiProperty({ description: 'Segment name', example: 'Active Users' })
    @IsString()
    @IsNotEmpty()
    name: string;
    @ApiPropertyOptional({ description: 'Segment description' })
    @IsString()
    @IsOptional()
    description?: string;
    @ApiPropertyOptional({ description: 'Dynamic or static segment', default: true })
    @IsBoolean()
    @IsOptional()
    isDynamic?: boolean;
    @ApiPropertyOptional({ type: [CreateSegmentRuleDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSegmentRuleDto)
    @IsOptional()
    rules?: CreateSegmentRuleDto[];
}
