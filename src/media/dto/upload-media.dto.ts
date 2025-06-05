import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MediaType } from '../entities/media.entity';

export class UploadMediaDto {
  @ApiProperty({ description: 'Media type' })
  @IsEnum(MediaType)
  type: MediaType;

  @ApiProperty({ description: 'Description of the media', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Tags for the media', required: false })
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}
