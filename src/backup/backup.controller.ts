import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RecoveryTestingService } from './testing/recovery-testing.service';
import { DisasterRecoveryService } from './disaster-recovery/disaster-recovery.service';
import { BackupMonitoringService } from './monitoring/backup-monitoring.service';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import { TriggerRecoveryTestDto } from './dto/trigger-recovery-test.dto';
import { RecoveryTestResponseDto } from './dto/recovery-test-response.dto';

@ApiTags('backup')
@ApiBearerAuth()
@Controller('backup')
export class BackupController {
  constructor(
    private readonly recoveryTestingService: RecoveryTestingService,
    private readonly disasterRecoveryService: DisasterRecoveryService,
    private readonly backupMonitoringService: BackupMonitoringService,
  ) {}

  @Post('restore')
  @ApiOperation({ summary: 'Restore from backup' })
  @HttpCode(HttpStatus.ACCEPTED)
  async restoreBackup(
    @Body() dto: RestoreBackupDto,
  ): Promise<{ message: string }> {
    await this.disasterRecoveryService.executeRestore(dto.backupRecordId);
    return { message: 'Restore initiated' };
  }

  @Post('test')
  @ApiOperation({ summary: 'Trigger recovery test' })
  async triggerRecoveryTest(
    @Body() dto: TriggerRecoveryTestDto,
  ): Promise<RecoveryTestResponseDto> {
    return this.recoveryTestingService.createRecoveryTest(dto.backupRecordId);
  }

  @Get('test/:testId')
  @ApiOperation({ summary: 'Get recovery test results' })
  async getRecoveryTest(
    @Param('testId', ParseUUIDPipe) testId: string,
  ): Promise<RecoveryTestResponseDto> {
    return this.recoveryTestingService.getTestResults(testId);
  }

  @Get('health')
  @ApiOperation({ summary: 'Get backup system health' })
  async getBackupHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    return this.backupMonitoringService.checkBackupHealth();
  }
}
