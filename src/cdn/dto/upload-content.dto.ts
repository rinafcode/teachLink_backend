import { IsOptional, IsString, IsNumber, IsBoolean, IsEnum, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UploadContentDto {
  @ApiPropertyOptional({
    description: 'Whether to optimize the content automatically',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  optimize?: boolean = true;

  @ApiPropertyOptional({
    description: 'Target width for image optimization',
    minimum: 1,
    maximum: 4096,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4096)
  width?: number;

  @ApiPropertyOptional({
    description: 'Target height for image optimization',
    minimum: 1,
    maximum: 4096,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4096)
  height?: number;

  @ApiPropertyOptional({
    description: 'Image quality (1-100)',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  quality?: number;

  @ApiPropertyOptional({
    description: 'Output format',
    enum: ['webp', 'jpeg', 'png'],
  })
  @IsOptional()
  @IsString()
  format?: 'webp' | 'jpeg' | 'png';

  @ApiPropertyOptional({
    description: 'User location for geo-optimization',
  })
  @IsOptional()
  @IsString()
  userLocation?: string;

  @ApiPropertyOptional({
    description: 'User bandwidth in Mbps for optimization',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bandwidth?: number;

  @ApiPropertyOptional({
    description: 'Generate responsive image variants',
  })
  @IsOptional()
  @IsBoolean()
  responsive?: boolean;
}
