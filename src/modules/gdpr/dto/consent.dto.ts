import { IsBoolean, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConsentDto {
  @ApiProperty({ description: 'Type of consent', example: 'marketing_emails' })
  @IsString()
  consentType: string;

  @ApiProperty({ description: 'Whether consent is granted', example: true })
  @IsBoolean()
  granted: boolean;
}
