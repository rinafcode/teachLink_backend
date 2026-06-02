import {
  IsArray,
  IsString,
  IsNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Defines the bulk-delete media payload.
 *
 * The original file was missing `@IsArray()`, which meant a plain string
 * (or any non-array value) would pass validation silently.
 * `@ArrayMinSize(1)` prevents empty-array no-ops from reaching the service.
 */
export class BulkDeleteMediaDto {
  /**
   * List of content IDs to delete from the CDN.
   * Must contain between 1 and 100 IDs per request.
   */
  @ApiProperty({
    type: [String],
    description: 'List of content IDs to delete (1–100 items)',
    example: ['abc123', 'def456'],
  })
  @IsArray({ message: 'contentIds must be an array' })
  @ArrayMinSize(1, { message: 'At least one content ID is required' })
  @ArrayMaxSize(100, { message: 'Cannot delete more than 100 items at once' })
  @IsString({ each: true, message: 'Each content ID must be a string' })
  @IsNotEmpty({ each: true, message: 'Content IDs cannot be empty strings' })
  contentIds: string[];
}