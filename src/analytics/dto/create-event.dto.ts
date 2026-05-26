import { IsString, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MaxLength(64)
  category: string;

  @IsString()
  @MaxLength(64)
  action: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  label?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;
}
