import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

/**
 * Base DTO for command metadata
 */
export class CommandMetadataDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsObject()
  additionalInfo?: Record<string, any>;
}

/**
 * Base DTO for commands
 */
export class CommandDto<T = any> {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsNotEmpty()
  payload: T;

  @IsOptional()
  metadata?: CommandMetadataDto;
}

/**
 * Base DTO for query metadata
 */
export class QueryMetadataDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsObject()
  additionalInfo?: Record<string, any>;
}

/**
 * Base DTO for queries
 */
export class QueryDto<T = any> {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsNotEmpty()
  parameters: T;

  @IsOptional()
  metadata?: QueryMetadataDto;
}

/**
 * DTO for command response
 */
export class CommandResponseDto<T = any> {
  @IsString()
  @IsNotEmpty()
  commandId: string;

  @IsString()
  @IsNotEmpty()
  status: 'success' | 'error' | 'pending';

  @IsOptional()
  result?: T;

  @IsOptional()
  @IsString()
  message?: string;
}

/**
 * DTO for query response
 */
export class QueryResponseDto<T = any> {
  @IsString()
  @IsNotEmpty()
  queryId: string;

  @IsString()
  @IsNotEmpty()
  status: 'success' | 'error';

  @IsOptional()
  result?: T;

  @IsOptional()
  @IsString()
  message?: string;
}