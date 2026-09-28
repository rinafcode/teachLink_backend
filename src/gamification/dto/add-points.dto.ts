import { IsInt, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const MAX_MANUAL_POINT_AWARD = 10000;

export class AddPointsDto {
  @ApiProperty({ description: 'User ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Points to add', example: 100 })
  @IsInt()
  @Min(1)
  @Max(MAX_MANUAL_POINT_AWARD)
  points: number;

  @ApiProperty({ description: 'Activity type identifier', example: 'COURSE_COMPLETED' })
  @IsString()
  activityType: string;
}
