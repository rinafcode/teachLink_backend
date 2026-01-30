import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BackupStatus } from '../enums/backup-status.enum';
import { BackupType } from '../enums/backup-type.enum';
import { Region } from '../enums/region.enum';

export class BackupResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: BackupType })
  backupType: BackupType;

  @ApiProperty({ enum: BackupStatus })
  status: BackupStatus;

  @ApiProperty({ enum: Region })
  region: Region;

  @ApiProperty()
  databaseName: string;

  @ApiPropertyOptional()
  backupSizeBytes?: number;

  @ApiPropertyOptional()
  integrityVerified?: boolean;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  expiresAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  metadata?: {
    pgVersion?: string;
    tableCounts?: Record<string, number>;
    totalRows?: number;
    dumpDuration?: number;
  };
}
