import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsArray, IsOptional, IsEnum, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import {
  RoutingConditionType,
  RoutingOperator,
  RoutingActionType,
  RoutingCondition,
  RoutingAction,
  RoutingTransformation,
  RoutingRule,
  DynamicRoutingConfig
} from '../interfaces/routing.interface';

/**
 * DTO for creating routing conditions
 */
export class CreateRoutingConditionDto implements RoutingCondition {
  @ApiProperty({ enum: RoutingConditionType, description: 'Type of condition' })
  @IsEnum(RoutingConditionType)
  type: RoutingConditionType;

  @ApiProperty({ description: 'Field to evaluate' })
  @IsString()
  field: string;

  @ApiProperty({ enum: RoutingOperator, description: 'Comparison operator' })
  @IsEnum(RoutingOperator)
  operator: RoutingOperator;

  @ApiProperty({ description: 'Value to compare against' })
  value: string | string[] | RegExp;

  @ApiPropertyOptional({ description: 'Whether comparison is case sensitive' })
  @IsOptional()
  @IsBoolean()
  caseSensitive?: boolean;
}

/**
 * DTO for creating routing transformations
 */
export class CreateRoutingTransformationDto implements RoutingTransformation {
  @ApiProperty({ enum: ['header', 'query', 'body', 'path'], description: 'Type of transformation' })
  @IsEnum(['header', 'query', 'body', 'path'])
  type: 'header' | 'query' | 'body' | 'path';

  @ApiProperty({ enum: ['add', 'remove', 'modify', 'rename'], description: 'Transformation operation' })
  @IsEnum(['add', 'remove', 'modify', 'rename'])
  operation: 'add' | 'remove' | 'modify' | 'rename';

  @ApiProperty({ description: 'Field to transform' })
  @IsString()
  field: string;

  @ApiPropertyOptional({ description: 'New value for the field' })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ description: 'New field name (for rename operation)' })
  @IsOptional()
  @IsString()
  newField?: string;
}

/**
 * DTO for creating routing actions
 */
export class CreateRoutingActionDto implements RoutingAction {
  @ApiProperty({ enum: RoutingActionType, description: 'Type of action' })
  @IsEnum(RoutingActionType)
  type: RoutingActionType;

  @ApiProperty({ description: 'Target for the action' })
  @IsString()
  target: string;

  @ApiPropertyOptional({ description: 'Additional parameters for the action' })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({ type: [CreateRoutingTransformationDto], description: 'Request transformations to apply' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRoutingTransformationDto)
  transformations?: RoutingTransformation[];
}

/**
 * DTO for creating routing rules
 */
export class CreateRoutingRuleDto {
  @ApiProperty({ description: 'Unique identifier for the rule' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Human-readable name for the rule' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Description of what the rule does' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Priority of the rule (higher = evaluated first)' })
  @IsNumber()
  priority: number;

  @ApiPropertyOptional({ description: 'Whether the rule is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ type: [CreateRoutingConditionDto], description: 'Conditions that must be met' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRoutingConditionDto)
  conditions: RoutingCondition[];

  @ApiProperty({ type: CreateRoutingActionDto, description: 'Action to take when conditions are met' })
  @ValidateNested()
  @Type(() => CreateRoutingActionDto)
  action: RoutingAction;

  @ApiPropertyOptional({ description: 'Additional metadata for the rule' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * DTO for updating routing rules
 */
export class UpdateRoutingRuleDto {
  @ApiPropertyOptional({ description: 'Human-readable name for the rule' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Description of what the rule does' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Priority of the rule (higher = evaluated first)' })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional({ description: 'Whether the rule is enabled' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: [CreateRoutingConditionDto], description: 'Conditions that must be met' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRoutingConditionDto)
  conditions?: RoutingCondition[];

  @ApiPropertyOptional({ type: CreateRoutingActionDto, description: 'Action to take when conditions are met' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateRoutingActionDto)
  action?: RoutingAction;

  @ApiPropertyOptional({ description: 'Additional metadata for the rule' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * DTO for updating routing configuration
 */
export class UpdateRoutingConfigDto {
  @ApiPropertyOptional({ type: CreateRoutingActionDto, description: 'Default action when no rules match' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateRoutingActionDto)
  defaultAction?: RoutingAction;

  @ApiPropertyOptional({ description: 'Enable request/response logging' })
  @IsOptional()
  @IsBoolean()
  enableLogging?: boolean;

  @ApiPropertyOptional({ description: 'Enable routing metrics collection' })
  @IsOptional()
  @IsBoolean()
  enableMetrics?: boolean;

  @ApiPropertyOptional({ description: 'Cache configuration' })
  @IsOptional()
  @IsObject()
  cacheConfig?: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

/**
 * Response DTO for routing rules
 */
export class RoutingRuleResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Routing rule data' })
  data: RoutingRule;

  @ApiProperty({ description: 'Response message' })
  message: string;
}

/**
 * Response DTO for routing configuration
 */
export class RoutingConfigResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Routing configuration data' })
  data: DynamicRoutingConfig;

  @ApiProperty({ description: 'Response message' })
  message: string;
}

/**
 * Response DTO for routing statistics
 */
export class RoutingStatsResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Routing statistics data' })
  data: {
    rulesCount: number;
    enabledRulesCount: number;
    cacheSize: number;
    cacheEnabled: boolean;
    rulesByPriority: Array<{
      id: string;
      name: string;
      priority: number;
      enabled: boolean;
    }>;
    conditionTypes: Record<string, number>;
    actionTypes: Record<string, number>;
  };

  @ApiProperty({ description: 'Response message' })
  message: string;
}

/**
 * DTO for testing routing rules
 */
export class TestRoutingRequestDto {
  @ApiPropertyOptional({ description: 'HTTP method', default: 'GET' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ description: 'Request path', default: '/' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ description: 'Request headers' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Query parameters' })
  @IsOptional()
  @IsObject()
  query?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Request body' })
  @IsOptional()
  body?: any;

  @ApiPropertyOptional({ description: 'Client IP address' })
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional({ description: 'User agent string' })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiPropertyOptional({ description: 'Tenant information' })
  @IsOptional()
  @IsObject()
  tenant?: {
    id: string;
    slug: string;
    domain: string;
  };

  @ApiPropertyOptional({ description: 'User information' })
  @IsOptional()
  @IsObject()
  user?: {
    id: string;
    role: string;
    permissions?: string[];
  };
}