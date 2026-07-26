import { IsArray, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ShardMigrationPlan } from '../interfaces/shard.interface';

export class ManualRebalanceDto {
  @ApiProperty({ description: 'List of migration plans to execute', type: 'array', items: { type: 'object' } })
  @IsArray()
  migrations: ShardMigrationPlan[];

  @ApiProperty({ description: 'Whether to run in dry-run mode' })
  @IsBoolean()
  dryRun: boolean;
}
