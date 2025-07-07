import { IsString, IsEnum, IsOptional, IsNumber, IsObject, IsDateString } from 'class-validator';
import { ActionType, ActionSeverity } from '../entities/moderation-action.entity';

export class CreateModerationActionDto {
  @IsString()
  contentId: string;

  @IsString()
  contentType: string;

  @IsEnum(ActionType)
  actionType: ActionType;

  @IsEnum(ActionSeverity)
  severity: ActionSeverity;

  @IsString()
  reason: string;

  @IsOptional()
  @IsObject()
  evidence?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateModerationActionDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsObject()
  evidence?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
} 