import {
  IsString,
  IsEmail,
  IsUUID,
  IsEnum,
  IsOptional,
  IsArray,
  IsObject,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CertificateType } from '../entities/certificate.entity';

export class CreateCertificateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(CertificateType)
  type: CertificateType;

  @IsUUID()
  recipientId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  recipientName: string;

  @IsEmail()
  recipientEmail: string;

  @IsUUID()
  issuerId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  issuerName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  issuerOrganization: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
