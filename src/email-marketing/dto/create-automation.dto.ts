import { IsString, IsOptional, IsArray, IsNotEmpty, ValidateNested, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TriggerType } from '../enums/trigger-type.enum';
import { ActionType } from '../enums/action-type.enum';

export class CreateTriggerDto {
    @ApiProperty({ enum: TriggerType })
    @IsEnum(TriggerType)
    type: TriggerType;

    @ApiPropertyOptional({ description: 'Trigger conditions' })
    @IsOptional()
    conditions?: Record<string, any>;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    description?: string;
}

export class CreateActionDto {
    @ApiProperty({ enum: ActionType })
    @IsEnum(ActionType)
    type: ActionType;

    @ApiProperty({ description: 'Action configuration' })
    config: Record<string, any>;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    description?: string;
}

export class CreateAutomationDto {
    @ApiProperty({ description: 'Workflow name', example: 'Welcome Series' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ description: 'Workflow description' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ type: [CreateTriggerDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateTriggerDto)
    @IsOptional()
    triggers?: CreateTriggerDto[];

    @ApiPropertyOptional({ type: [CreateActionDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateActionDto)
    @IsOptional()
    actions?: CreateActionDto[];
}
