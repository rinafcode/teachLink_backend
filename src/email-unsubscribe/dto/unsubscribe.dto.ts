import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UnsubscribeDto {
  @ApiProperty({ description: 'One-time unsubscribe token' })
  @IsString()
  token: string;
}

export class ResubscribeDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Email type to resubscribe to' })
  @IsOptional()
  @IsString()
  emailType?: string;
}

export class UpdateEmailPreferencesDto {
  @ApiProperty({ description: 'Email address' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ type: [String], description: 'Email types to subscribe to' })
  @IsOptional()
  @IsString({ each: true })
  preferences?: string[];
}