import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum ResourceType {
  DOCUMENT = 'document',
  WHITEBOARD = 'whiteboard',
}

export class JoinSessionDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(ResourceType)
  @IsNotEmpty()
  resourceType: ResourceType;
}

export class CollaborativeOperationDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(ResourceType)
  @IsNotEmpty()
  resourceType: ResourceType;

  @IsOptional()
  operation: any;
}

export class SyncRequestDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}
