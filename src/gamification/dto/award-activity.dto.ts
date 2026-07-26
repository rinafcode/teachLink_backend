import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PointActivityType } from '../enums/point-activity.enum';

export class AwardActivityDto {
  @ApiProperty({ description: 'User ID', example: 'user_123' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Activity type', enum: PointActivityType })
  @IsEnum(PointActivityType)
  activityType: PointActivityType;
}
