import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecoveryTestStatus } from '../enums/recovery-test-status.enum';

export class RecoveryTestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  backupRecordId: string;

  @ApiProperty({ enum: RecoveryTestStatus })
  status: RecoveryTestStatus;

  @ApiProperty()
  testDatabaseName: string;

  @ApiPropertyOptional()
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
  performanceMetrics?: {
    totalDuration?: number;
  };

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  testCompletedAt?: Date;
}
