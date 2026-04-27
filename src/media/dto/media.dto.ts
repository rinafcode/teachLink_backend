import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BulkDeleteMediaDto {
  @ApiProperty({ type: [String], description: 'List of content IDs to delete' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  contentIds: string[];
}
