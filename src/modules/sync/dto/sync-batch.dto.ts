import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { SyncActionDto } from './sync-action.dto';

export class SyncBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncActionDto)
  actions: SyncActionDto[];
}
