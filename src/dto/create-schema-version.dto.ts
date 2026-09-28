import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateSchemaVersionDto {
  @ApiProperty({ description: 'Logical name of the schema (e.g., courses)', example: 'courses' })
  @IsString()
  schemaName: string;

  @ApiProperty({ description: 'Full JSON definition of the current schema' })
  definition: Record<string, any>;

  @ApiPropertyOptional({ description: 'Optional human readable description of the change' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Optional author identifier' })
  @IsOptional()
  @IsString()
  authorId?: string;
}
