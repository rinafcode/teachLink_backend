import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BackupStatus } from '../enums/backup-status.enum';
import { BackupType } from '../enums/backup-type.enum';
import { Region } from '../enums/region.enum';
import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDate,
} from 'class-validator';

export class BackupResponseDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  @IsString()
  id: string;

  @ApiProperty({ enum: BackupType })
  @IsNotEmpty()
  backupType: BackupType;

  @ApiProperty({ enum: BackupStatus })
  @IsNotEmpty()
  status: BackupStatus;

  @ApiProperty({ enum: Region })
  @IsNotEmpty()
  region: Region;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  databaseName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  backupSizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  integrityVerified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  completedAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  expiresAt?: Date;

  @ApiProperty()
  @IsNotEmpty()
  @IsDate()
  createdAt: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metadata?: {
    pgVersion?: string;
    tableCounts?: Record<string, number>;
    totalRows?: number;
    dumpDuration?: number;
  };
}
