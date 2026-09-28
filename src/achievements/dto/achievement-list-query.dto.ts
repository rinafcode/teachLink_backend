import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class AchievementListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Include hidden achievements for admins' })
  @IsOptional()
  @IsString()
  includeHidden?: string;
}
