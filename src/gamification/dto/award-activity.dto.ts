import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PointActivityType } from '../enums/point-activity.enum';

export class AwardActivityDto {
  @ApiProperty({ description: 'Activity type', enum: PointActivityType })
  @IsEnum(PointActivityType)
  activityType: PointActivityType;
}
