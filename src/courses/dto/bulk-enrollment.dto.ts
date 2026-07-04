import {
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EnrollmentItemDto {
  @ApiProperty({ description: 'User ID to enroll' })
  @IsUUID('4', { message: 'userId must be a valid UUID v4' })
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Course ID to enroll into' })
  @IsUUID('4', { message: 'courseId must be a valid UUID v4' })
  @IsNotEmpty()
  courseId: string;
}

export class BulkEnrollmentDto {
  @ApiProperty({ type: [EnrollmentItemDto], description: 'Array of enrollments' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500, { message: 'Cannot enroll more than 500 users at once' })
  @ValidateNested({ each: true })
  @Type(() => EnrollmentItemDto)
  enrollments: EnrollmentItemDto[];
}
