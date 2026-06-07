import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ContentReportDisposition {
  RESOLVE = 'resolve',
  DISMISS = 'dismiss',
}

export class ReviewContentReportDto {
  @ApiProperty({
    enum: ContentReportDisposition,
    description: 'The final moderation outcome for the report.',
    example: ContentReportDisposition.RESOLVE,
  })
  @IsEnum(ContentReportDisposition)
  disposition: ContentReportDisposition;

  @ApiProperty({
    description: 'Optional note explaining the moderation decision.',
    required: false,
    example: 'Confirmed spam content, report resolved.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  resolutionNote?: string;
}

