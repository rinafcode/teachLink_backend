import { IsString, IsNotEmpty, IsOptional, IsObject, IsNumber, Min } from 'class-validator';

export class ProxyRequestDto {
  @IsString()
  @IsNotEmpty()
  service: string;

  @IsString()
  @IsNotEmpty()
  path: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  body?: unknown;
}

export class RouteConfigDto {
  @IsString()
  @IsNotEmpty()
  service: string;

  @IsString()
  @IsNotEmpty()
  upstream: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cacheTtlSeconds?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rateLimitPerMinute?: number;
}
