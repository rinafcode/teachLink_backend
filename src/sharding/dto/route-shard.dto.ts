import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShardStrategy } from '../interfaces/shard.interface';

export class RouteShardDto {
  @ApiProperty({ description: 'Routing key, e.g. a userId, tenantId, or courseId', example: 'user_123' })
  @IsString()
  key: string;

  @ApiPropertyOptional({ description: 'Strategy override — defaults to HASH_BASED', enum: ShardStrategy })
  @IsOptional()
  @IsEnum(ShardStrategy)
  strategy?: ShardStrategy;

  @ApiPropertyOptional({ description: 'Route to read replica if true' })
  @IsOptional()
  @IsBoolean()
  forRead?: boolean;
}
