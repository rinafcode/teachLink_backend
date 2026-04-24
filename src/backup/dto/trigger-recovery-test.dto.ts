import { IsUUID, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Defines the trigger Recovery Test payload.
 */
export class TriggerRecoveryTestDto {
  @ApiProperty({ description: 'Backup record ID to test' })
  @IsUUID()
  @IsNotEmpty()
  @IsString()
  backupRecordId: string;
}
