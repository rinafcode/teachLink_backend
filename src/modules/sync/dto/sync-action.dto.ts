import { IsObject, IsString } from 'class-validator';

export class SyncActionDto {
  @IsString()
  actionType: string;

  @IsObject()
  payload: Record<string, any>;
}
