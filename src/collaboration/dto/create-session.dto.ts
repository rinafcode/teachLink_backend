import { IsString, IsEnum, IsNotEmpty } from 'class-validator';

export enum ResourceType {
  DOCUMENT = 'document',
  WHITEBOARD = 'whiteboard',
}

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsEnum(ResourceType)
  @IsNotEmpty()
  resourceType: ResourceType;
}
