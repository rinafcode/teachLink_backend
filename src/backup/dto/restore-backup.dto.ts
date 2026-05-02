import { IsUUID, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Defines the restore Backup payload.
 */
export class RestoreBackupDto {
    @ApiProperty({ description: 'Backup record ID to restore from' })
    @IsUUID()
    @IsNotEmpty()
    @IsString()
    backupRecordId: string;
}
