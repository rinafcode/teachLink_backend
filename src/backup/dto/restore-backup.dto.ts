import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RestoreBackupDto {
  @ApiProperty({ description: 'Backup record ID to restore from' })
  @IsUUID()
  backupRecordId: string;
}
