import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateCohortCommentDto {
  @ApiProperty({ example: 'I found the event loop explanation very helpful.' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: 'ebc12796-7ed5-4e30-a4c9-052faf919469' })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
