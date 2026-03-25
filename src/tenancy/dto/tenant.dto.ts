import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  Min,
  IsNotEmpty,
  IsNumber,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantStatus, TenantPlan } from '../entities/tenant.entity';

export class CreateTenantDto {
  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Leading provider of innovative solutions' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'acme.com' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ enum: TenantPlan, default: TenantPlan.FREE })
  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;

  @ApiPropertyOptional({ example: 'owner@acme.com' })
  @IsOptional()
  @IsEmail()
  @IsString()
  ownerEmail?: string;

  @ApiPropertyOptional({ example: 'contact@acme.com' })
  @IsOptional()
  @IsEmail()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @IsNumber()
  userLimit?: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @IsNumber()
  storageLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @IsString()
  metadata?: Record<string, any>;
}

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Acme Corporation' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Leading provider of innovative solutions' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'acme.com' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ enum: TenantStatus })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiPropertyOptional({ enum: TenantPlan })
  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;

  @ApiPropertyOptional({ example: 'contact@acme.com' })
  @IsOptional()
  @IsEmail()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @IsNumber()
  userLimit?: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @IsNumber()
  storageLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @IsString()
  metadata?: Record<string, any>;
}

export class UpdateTenantConfigDto {
  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  defaultLanguage?: string;

  @ApiPropertyOptional({ example: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @IsString()
  features?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @IsString()
  notifications?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @IsString()
  security?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @IsString()
  integrations?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @IsString()
  customSettings?: Record<string, any>;
}

export class UpdateTenantCustomizationDto {
  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsString()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/favicon.ico' })
  @IsOptional()
  @IsString()
  @IsUrl()
  faviconUrl?: string;

  @ApiPropertyOptional({ example: '#007bff' })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#6c757d' })
  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @ApiPropertyOptional({ example: '#28a745' })
  @IsOptional()
  @IsString()
  accentColor?: string;

  @ApiPropertyOptional({ example: 'Roboto, sans-serif' })
  @IsOptional()
  @IsString()
  fontFamily?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @IsString()
  theme?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customCss?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customJs?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @IsEmail()
  @IsString()
  emailTemplates?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @IsString()
  landingPageConfig?: Record<string, any>;

  @ApiPropertyOptional({ example: 'custom.acme.com' })
  @IsOptional()
  @IsString()
  customDomain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @IsUrl()
  @IsString()
  socialLinks?: Record<string, string>;
}
