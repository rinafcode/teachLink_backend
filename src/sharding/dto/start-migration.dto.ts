import { IsBoolean, IsInt, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartMigrationDto {
  @ApiProperty({ description: 'Source shard ID', example: 'shard-00' })
  @IsString()
  sourceShardId: string;

  @ApiProperty({ description: 'Target shard ID', example: 'shard-01' })
  @IsString()
  targetShardId: string;

  @ApiProperty({ description: 'Entity type to migrate', example: 'users' })
  @IsString()
  entityType: string;

  @ApiProperty({ description: 'Estimated number of rows to migrate', example: 50000 })
  @IsInt()
  @Min(1)
  estimatedRowCount: number;

  @ApiProperty({ description: 'Batch size for migration', example: 1000 })
  @IsInt()
  @Min(1)
  batchSize: number;

  @ApiProperty({ description: 'Whether to run in dry-run mode' })
  @IsBoolean()
  dryRun: boolean;
}
