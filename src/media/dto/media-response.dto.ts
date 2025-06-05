import { ApiProperty } from '@nestjs/swagger';
import { MediaType, MediaStatus } from '../entities/media.entity';

export class MediaResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  filename: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  size: number;

  @ApiProperty({ enum: MediaType })
  type: MediaType;

  @ApiProperty({ enum: MediaStatus })
  status: MediaStatus;

  @ApiProperty()
  storageUrl: string;

  @ApiProperty({ required: false })
  thumbnailUrl?: string;

  @ApiProperty({ required: false })
  metadata?: {
    duration?: number;
    width?: number;
    height?: number;
    bitrate?: number;
    qualities?: string[];
    pageCount?: number;
    wordCount?: number;
  };

  @ApiProperty({ required: false })
  processingData?: {
    transcodeJobId?: string;
    qualities?: { [key: string]: string };
  };

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
