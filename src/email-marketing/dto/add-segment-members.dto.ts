import { IsArray, IsString, ArrayNotEmpty, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Defines the add Segment Members payload.
 */
export class AddSegmentMembersDto {
  @ApiProperty({
    description: 'Array of user IDs to add to the segment',
    example: ['user1', 'user2', 'user3'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty()
  userIds: string[];
}
