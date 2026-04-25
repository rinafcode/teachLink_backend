import { IsString, IsOptional, IsObject, IsNumber, IsDateString, IsEnum, IsArray, IsBoolean, Min, Max, ValidateNested, IsNotEmpty, } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobPriority } from '../enums/job-priority.enum';
// ── Sub-DTOs ─────────────────────────────────────────────────────────────────
export class BackoffOptionsDto {
    @ApiProperty({ enum: ['fixed', 'exponential'] })
    @IsEnum(['fixed', 'exponential'])
    type: 'fixed' | 'exponential';
    @ApiProperty({ minimum: 0 })
    @IsNumber()
    @Min(0)
    delay: number;
}
export class JobOptionsDto {
    @ApiPropertyOptional({ enum: JobPriority })
    @IsOptional()
    @IsEnum(JobPriority)
    priority?: JobPriority;
    @ApiPropertyOptional({ minimum: 1, maximum: 20 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(20)
    attempts?: number;
    @ApiPropertyOptional()
    @IsOptional()
    @ValidateNested()
    @Type(() => BackoffOptionsDto)
    backoff?: BackoffOptionsDto;
    @ApiPropertyOptional({ minimum: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    delay?: number;
    @ApiPropertyOptional({ minimum: 1000 })
    @IsOptional()
    @IsNumber()
    @Min(1000)
    timeout?: number;
    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    removeOnComplete?: boolean;
    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    removeOnFail?: boolean;
}
export class PriorityFactorsDto {
    @ApiPropertyOptional({ enum: ['premium', 'pro', 'basic', 'free'] })
    @IsOptional()
    @IsEnum(['premium', 'pro', 'basic', 'free'])
    userTier?: 'premium' | 'pro' | 'basic' | 'free';
    @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'] })
    @IsOptional()
    @IsEnum(['critical', 'high', 'medium', 'low'])
    urgency?: 'critical' | 'high' | 'medium' | 'low';
}
// ── Request DTOs ──────────────────────────────────────────────────────────────
export class AddJobDto {
    @ApiProperty({ description: 'Job type / processor name' })
    @IsString()
    @IsNotEmpty()
    name: string;
    @ApiProperty({ description: 'Arbitrary job payload' })
    @IsObject()
    data: Record<string, unknown>;
    @ApiPropertyOptional()
    @IsOptional()
    @ValidateNested()
    @Type(() => JobOptionsDto)
    options?: JobOptionsDto;
    @ApiPropertyOptional()
    @IsOptional()
    @ValidateNested()
    @Type(() => PriorityFactorsDto)
    priorityFactors?: PriorityFactorsDto;
}
export class BulkJobItemDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;
    @ApiProperty()
    @IsObject()
    data: Record<string, unknown>;
    @ApiPropertyOptional()
    @IsOptional()
    @ValidateNested()
    @Type(() => JobOptionsDto)
    options?: JobOptionsDto;
}
export class AddBulkJobsDto {
    @ApiProperty({ type: [BulkJobItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BulkJobItemDto)
    jobs: BulkJobItemDto[];
}
export class ScheduleJobDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;
    @ApiProperty()
    @IsObject()
    data: Record<string, unknown>;
    @ApiProperty({ description: 'ISO-8601 datetime string (must be in the future)' })
    @IsDateString()
    scheduledTime: string;
    @ApiPropertyOptional()
    @IsOptional()
    @ValidateNested()
    @Type(() => JobOptionsDto)
    options?: JobOptionsDto;
}
export class ScheduleDelayedJobDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;
    @ApiProperty()
    @IsObject()
    data: Record<string, unknown>;
    @ApiProperty({ description: 'Delay in milliseconds', minimum: 0 })
    @IsNumber()
    @Min(0)
    delayMs: number;
    @ApiPropertyOptional()
    @IsOptional()
    @ValidateNested()
    @Type(() => JobOptionsDto)
    options?: JobOptionsDto;
}
export class CleanQueueDto {
    @ApiPropertyOptional({ description: 'Grace period in ms (default 5000)', minimum: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    grace?: number;
    @ApiPropertyOptional({ enum: ['completed', 'failed'] })
    @IsOptional()
    @IsEnum(['completed', 'failed'])
    status?: 'completed' | 'failed';
}
export class FailedJobsQueryDto {
    @ApiPropertyOptional({
        description: 'Maximum number of jobs to return',
        minimum: 1,
        maximum: 200,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(200)
    limit?: number;
    @ApiPropertyOptional({ description: 'Page offset (0-based)', minimum: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    offset?: number;
    @ApiPropertyOptional({ description: 'Filter by job name / type' })
    @IsOptional()
    @IsString()
    jobName?: string;
}
export class StuckJobsQueryDto {
    @ApiPropertyOptional({
        description: 'Threshold in ms — jobs active longer are considered stuck',
        minimum: 5000,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(5000)
    threshold?: number;
}
export class AnalyticsQueryDto {
    @ApiPropertyOptional({
        description: 'Lookback window in minutes (default: 60)',
        minimum: 1,
        maximum: 1440,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(1440)
    windowMinutes?: number;
}
