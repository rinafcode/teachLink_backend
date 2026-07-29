import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ description: 'Resource name (e.g. "users", "courses")', example: 'users' })
  @IsString()
  @MaxLength(100)
  resource: string;

  @ApiProperty({ description: 'Action name (e.g. "read", "write", "delete")', example: 'read' })
  @IsString()
  @MaxLength(100)
  action: string;

  @ApiPropertyOptional({ description: 'Optional description of the permission', example: 'Can read user profiles' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
