import { IsString } from 'class-validator';

export class SuggestQueryDto {
  @IsString()
  prefix: string;
}
