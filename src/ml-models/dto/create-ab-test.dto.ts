import { IsString, IsOptional, IsEnum, IsObject, IsArray, IsNumber, Min, Max } from 'class-validator';
import { ABTestType } from '../enums';

export class CreateABTestDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ABTestType)
  type: ABTestType;

  @IsString()
  modelAId: string;

  @IsString()
  modelBId: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(0.9)
  trafficSplit?: number;

  @IsOptional()
  @IsObject()
  testConfig?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  successMetrics?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  guardrailMetrics?: string[];

  @IsOptional()
  @IsNumber()
  @Min(100)
  minSampleSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  maxDurationDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(0.1)
  significanceLevel?: number;

  @IsOptional()
  @IsString()
  createdBy?: string;
} 