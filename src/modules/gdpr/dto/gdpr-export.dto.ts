import { Exclude } from 'class-transformer';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class GdprExportDto {
  @Exclude()
  @IsOptional()
  @IsString()
  password?: string;

  @Exclude()
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @Exclude()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  passwordHistory?: string[];

  @Exclude()
  @IsOptional()
  @IsString()
  totpSecret?: string;

  @Exclude()
  @IsOptional()
  @IsString()
  token?: string;

  constructor(partial: Partial<GdprExportDto>) {
    Object.assign(this, partial);
  }
}
