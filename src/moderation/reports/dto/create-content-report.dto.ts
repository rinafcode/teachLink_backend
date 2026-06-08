import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ContentReportReason } from '../content-report-reason.enum';

export class CreateContentReportDto {
  @ApiProperty({
    description: 'The type of content being reported.',
    example: 'course',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  contentType: string;

  @ApiProperty({
    description: 'The identifier of the reported content.',
    example: '9f5b6f1f-6d7a-4a4a-a1d8-8f6c4d5c9c11',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  contentId: string;

  @ApiProperty({
    enum: ContentReportReason,
    description: 'Why the content is being reported.',
    example: ContentReportReason.SPAM,
  })
  @IsEnum(ContentReportReason)
  reason: ContentReportReason;

  @ApiProperty({
    description: 'Optional details to help moderators understand the report.',
    required: false,
    example: 'The course description contains repeated promotional links.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  details?: string;
}

