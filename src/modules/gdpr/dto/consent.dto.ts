import { IsBoolean, IsString } from 'class-validator';

export class ConsentDto {
  @IsString()
  consentType: string;

  @IsBoolean()
  granted: boolean;
}
