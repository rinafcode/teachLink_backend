import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ResourceType {
  DOCUMENT = 'document',
  WHITEBOARD = 'whiteboard',
}

export class JoinSessionDto {
  @ApiProperty({ description: 'Session ID to join', example: 'session-abc-123' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ description: 'User ID of the joining user' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Resource type', enum: ResourceType, example: ResourceType.DOCUMENT })
  @IsEnum(ResourceType)
  @IsNotEmpty()
  resourceType: ResourceType;
}

export class CollaborativeOperationDto {
  @ApiProperty({ description: 'Session ID', example: 'session-abc-123' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ description: 'User ID performing the operation' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Resource type', enum: ResourceType, example: ResourceType.DOCUMENT })
  @IsEnum(ResourceType)
  @IsNotEmpty()
  resourceType: ResourceType;

  @ApiPropertyOptional({ description: 'Operation payload data' })
  @IsOptional()
  operation: any;
}

export class SyncRequestDto {
  @ApiProperty({ description: 'Session ID to sync', example: 'session-abc-123' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ description: 'User ID requesting sync' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
