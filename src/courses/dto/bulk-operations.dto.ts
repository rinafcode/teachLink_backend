import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Maximum number of courses allowed in a single bulk request.
 * Keeps single-request memory/transaction size bounded.
 */
export const BULK_OPERATION_MAX_COURSES = 200;

/**
 * Common shape for any bulk request: a non-empty, de-duplicated
 * array of course UUIDs that the caller wants to operate on.
 */
export class BulkCourseIdsDto {
  @ApiProperty({
    type: [String],
    description: 'List of course IDs to operate on (max 200, must be unique).',
    example: ['8a4cd9b2-9f9d-4f4f-8c2c-1f0c5e6e1a11'],
  })
  @IsArray({ message: 'courseIds must be an array' })
  @ArrayMinSize(1, { message: 'At least one course ID is required' })
  @ArrayMaxSize(BULK_OPERATION_MAX_COURSES, {
    message: `Cannot operate on more than ${BULK_OPERATION_MAX_COURSES} courses at once`,
  })
  @ArrayUnique({ message: 'courseIds must not contain duplicates' })
  @IsUUID('4', { each: true, message: 'Every course ID must be a valid UUID v4' })
  courseIds: string[];
}

/**
 * Bulk publish or unpublish a list of courses.
 * `publish=true` moves courses into PUBLISHED, `publish=false` moves
 * them to ARCHIVED (instructor-driven unpublish).
 */
export class BulkPublishDto extends BulkCourseIdsDto {
  @ApiProperty({
    description:
      'When true, courses are published. When false, courses are unpublished (archived).',
  })
  @IsBoolean({ message: 'publish must be a boolean' })
  publish: boolean;
}

/**
 * Bulk update the price of a list of courses.
 */
export class BulkPriceUpdateDto extends BulkCourseIdsDto {
  @ApiProperty({
    description: 'New price to apply to every selected course.',
    minimum: 0,
    example: 49.99,
  })
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: 'price must be a number with up to 2 decimal places' },
  )
  @Min(0, { message: 'price cannot be negative' })
  price: number;
}

/**
 * Bulk update the category of a list of courses.
 * Pass `category: null` to clear the category for all selected courses.
 */
export class BulkCategoryUpdateDto extends BulkCourseIdsDto {
  @ApiPropertyOptional({
    description:
      'New category to apply to every selected course. Pass null/omit to clear the category.',
    nullable: true,
    example: 'web-development',
  })
  @IsOptional()
  @IsString({ message: 'category must be a string' })
  @MinLength(1, { message: 'category cannot be empty' })
  @MaxLength(100, { message: 'category cannot exceed 100 characters' })
  category?: string | null;
}
