import { IsString, IsOptional, IsEnum, IsObject, IsArray, IsNumber, Min, Max } from 'class-validator';
import { ModelType, ModelFramework } from '../enums';

export class CreateModelDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ModelType)
  type: ModelType;

  @IsEnum(ModelFramework)
  framework: ModelFramework;

  @IsOptional()
  @IsObject()
  hyperparameters?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsString()
  targetVariable?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  createdBy?: string;
} 