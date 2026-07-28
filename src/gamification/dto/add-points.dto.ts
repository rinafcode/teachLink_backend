import { IsInt, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddPointsDto {
  @ApiProperty({ description: 'User ID', example: 'user_123' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Points to add', example: 100 })
  @IsNumber()
  @IsInt()
  @Min(1)
  points: number;

  @ApiProperty({ description: 'Activity type identifier', example: 'COURSE_COMPLETED' })
  @IsString()
  activityType: string;
}
