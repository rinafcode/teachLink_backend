import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePrivacyPreferencesDto {
  @ApiPropertyOptional({ description: 'Consent to sell personal data (CCPA)' })
  @IsOptional()
  @IsBoolean()
  sellPersonalData?: boolean;

  @ApiPropertyOptional({ description: 'Consent to share personal data (CCPA)' })
  @IsOptional()
  @IsBoolean()
  sharePersonalData?: boolean;

  @ApiPropertyOptional({ description: 'Consent to marketing tracking' })
  @IsOptional()
  @IsBoolean()
  marketingTracking?: boolean;
}
