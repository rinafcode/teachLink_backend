import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString } from 'class-validator';

export class AddCohortMemberDto {
  @ApiProperty({ example: '50f87278-3e39-4f90-8ce3-fae39d733458' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ example: 'member' })
  @IsString()
  @IsOptional()
  role?: string;
}
