import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, Min, Max, IsObject, } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export enum RateLimitType {
    IP = 'ip',
    USER = 'user',
    ENDPOINT = 'endpoint',
    GLOBAL = 'global'
}
export class CreateRateLimitingDto {
    @ApiProperty({
        description: 'Name of the rate limit rule',
        example: 'api-login-limit',
    })
    @IsString({ message: 'Name must be a string' })
    @IsNotEmpty({ message: 'Name is required' })
    name: string;
    @ApiProperty({
        description: 'Type of rate limiting',
        enum: RateLimitType,
        example: RateLimitType.USER,
    })
    @IsEnum(RateLimitType, { message: 'Type must be a valid rate limit type' })
    type: RateLimitType;
    @ApiProperty({
        description: 'Maximum number of requests allowed',
        example: 100,
        minimum: 1,
        maximum: 1000000,
    })
    @IsNumber({}, { message: 'Limit must be a number' })
    @Min(1, { message: 'Limit must be at least 1' })
    @Max(1000000, { message: 'Limit cannot exceed 1,000,000' })
    limit: number;
    @ApiProperty({
        description: 'Time window in seconds',
        example: 3600,
        minimum: 1,
        maximum: 86400,
    })
    @IsNumber({}, { message: 'Window must be a number' })
    @Min(1, { message: 'Window must be at least 1 second' })
    @Max(86400, { message: 'Window cannot exceed 24 hours' })
    windowSeconds: number;
    @ApiPropertyOptional({
        description: 'Specific endpoint to limit',
        example: '/api/auth/login',
    })
    @IsOptional()
    @IsString({ message: 'Endpoint must be a string' })
    endpoint?: string;
    @ApiPropertyOptional({
        description: 'Priority of this rule (higher = more important)',
        example: 1,
        minimum: 1,
        maximum: 100,
    })
    @IsOptional()
    @IsNumber({}, { message: 'Priority must be a number' })
    @Min(1, { message: 'Priority must be at least 1' })
    @Max(100, { message: 'Priority cannot exceed 100' })
    priority?: number;
    @ApiPropertyOptional({
        description: 'Whether this rule is enabled',
        default: true,
    })
    @IsOptional()
    @IsEnum([true, false], { message: 'Enabled must be a boolean' })
    enabled?: boolean;
    @ApiPropertyOptional({
        description: 'Additional metadata for the rule',
        example: {
            description: 'Limit login attempts per user',
            tags: ['auth', 'security'],
        },
    })
    @IsOptional()
    @IsObject({ message: 'Metadata must be an object' })
    metadata?: Record<string, unknown>;
}
