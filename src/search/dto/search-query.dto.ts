import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class SearchQueryDto {
  @IsString()
  q: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  from?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(1)
  size?: number = 10;
}
