import { Controller, Post, Get, Param, Body, ParseUUIDPipe, HttpCode, HttpStatus, UseGuards, } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecoveryTestingService } from './testing/recovery-testing.service';
import { DisasterRecoveryService } from './disaster-recovery/disaster-recovery.service';
import { BackupMonitoringService } from './monitoring/backup-monitoring.service';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import { TriggerRecoveryTestDto } from './dto/trigger-recovery-test.dto';
import { RecoveryTestResponseDto } from './dto/recovery-test-response.dto';

/**
 * Exposes backup endpoints.
 */
@ApiTags('backup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('backup')
export class BackupController {
  constructor(
    private readonly recoveryTestingService: RecoveryTestingService,
    private readonly disasterRecoveryService: DisasterRecoveryService,
    private readonly backupMonitoringService: BackupMonitoringService,
  ) {}

  /**
   * Executes restore Backup.
   * @param dto The dto.
   * @returns The operation result.
   */
  @Post('restore')
  @ApiOperation({ summary: 'Restore from backup' })
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Restore initiated' })
  @HttpCode(HttpStatus.ACCEPTED)
  async restoreBackup(@Body() dto: RestoreBackupDto): Promise<{ message: string }> {
    await this.disasterRecoveryService.executeRestore(dto.backupRecordId);
    return { message: 'Restore initiated' };
  }

  /**
   * Executes trigger Recovery Test.
   * @param dto The dto.
   * @returns The resulting recovery test response dto.
   */
  @Post('test')
  @ApiOperation({ summary: 'Trigger recovery test' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Recovery test triggered' })
  async triggerRecoveryTest(@Body() dto: TriggerRecoveryTestDto): Promise<RecoveryTestResponseDto> {
    return this.recoveryTestingService.createRecoveryTest(dto.backupRecordId);
  }

  /**
   * Returns recovery Test.
   * @param testId The test identifier.
   * @returns The resulting recovery test response dto.
   */
  @Get('test/:testId')
  @ApiOperation({ summary: 'Get recovery test results' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Recovery test results',
    type: RecoveryTestResponseDto,
  })
  async getRecoveryTest(
    @Param('testId', ParseUUIDPipe) testId: string,
  ): Promise<RecoveryTestResponseDto> {
    return this.recoveryTestingService.getTestResults(testId);
  }

  /**
   * Returns backup Health.
   * @returns The operation result.
   */
  @Get('health')
  @ApiOperation({ summary: 'Get backup system health' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Backup health status' })
  async getBackupHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    return this.backupMonitoringService.checkBackupHealth();
  }
}
