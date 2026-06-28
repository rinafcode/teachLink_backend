import { IsString, IsNotEmpty, IsOptional, IsObject, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProxyRequestDto {
  @ApiProperty({ description: 'Target service name', example: 'courses' })
  @IsString()
  @IsNotEmpty()
  service: string;

  @ApiProperty({ description: 'Request path within the service', example: '/api/v1/courses' })
  @IsString()
  @IsNotEmpty()
  path: string;

  @ApiPropertyOptional({ description: 'Additional headers to forward' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Request body' })
  @IsOptional()
  body?: unknown;
}

export class RouteConfigDto {
  @ApiProperty({ description: 'Service name', example: 'courses' })
  @IsString()
  @IsNotEmpty()
  service: string;

  @ApiProperty({ description: 'Upstream URL', example: 'http://courses-service:3001' })
  @IsString()
  @IsNotEmpty()
  upstream: string;

  @ApiPropertyOptional({ description: 'Route weight for load balancing', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  weight?: number;

  @ApiPropertyOptional({ description: 'Cache TTL in seconds', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cacheTtlSeconds?: number;

  @ApiPropertyOptional({ description: 'Rate limit per minute', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  rateLimitPerMinute?: number;
}
