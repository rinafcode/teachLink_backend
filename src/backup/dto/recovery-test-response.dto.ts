import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecoveryTestStatus } from '../enums/recovery-test-status.enum';
import { IsNotEmpty, IsUUID, IsString, IsOptional, IsNumber, IsDate } from 'class-validator';

/**
 * Defines the recovery Test Response payload.
 */
export class RecoveryTestResponseDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsUUID()
    @IsString()
    id: string;
    @ApiProperty()
    @IsNotEmpty()
    @IsUUID()
    @IsString()
    backupRecordId: string;
    @ApiProperty({ enum: RecoveryTestStatus })
    @IsNotEmpty()
    status: RecoveryTestStatus;
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    testDatabaseName: string;
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    validationResults?: {
        tableCountMatch?: boolean;
        rowCountMatch?: boolean;
        checksumMatch?: boolean;
        schemaValid?: boolean;
        connectionSuccessful?: boolean;
        queriesExecuted?: number;
        errors?: string[];
    };
    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    performanceMetrics?: {
        totalDuration?: number;
    };
    @ApiProperty()
    @IsNotEmpty()
    @IsDate()
    createdAt: Date;
    @ApiPropertyOptional()
    @IsOptional()
    @IsDate()
    testCompletedAt?: Date;
}
