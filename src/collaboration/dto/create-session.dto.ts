import { IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ResourceType {
  DOCUMENT = 'document',
  WHITEBOARD = 'whiteboard',
}

export class CreateSessionDto {
  @ApiProperty({ description: 'Unique session identifier', example: 'session-abc-123' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({
    description: 'Type of collaboration resource',
    enum: ResourceType,
    example: ResourceType.DOCUMENT,
  })
  @IsEnum(ResourceType)
  @IsNotEmpty()
  resourceType: ResourceType;
}
