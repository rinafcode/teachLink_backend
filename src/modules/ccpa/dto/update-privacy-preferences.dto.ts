import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePrivacyPreferencesDto {
  @IsOptional()
  @IsBoolean()
  sellPersonalData?: boolean;

  @IsOptional()
  @IsBoolean()
  sharePersonalData?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingTracking?: boolean;
}
