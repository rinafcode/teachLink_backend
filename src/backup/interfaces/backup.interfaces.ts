import { Region } from '../enums/region.enum';

export interface BackupJobData {
  backupRecordId: string;
  backupType: string;
  region: Region;
  databaseName: string;
}

export interface VerificationJobData {
  backupRecordId: string;
  storageKey: string;
}

export interface RecoveryTestJobData {
  recoveryTestId: string;
  backupRecordId: string;
  testDatabaseName: string;
}
