import { Region } from '../enums/region.enum';

export interface IBackupJobData {
  backupRecordId: string;
  backupType: string;
  region: Region;
  databaseName: string;
}

export interface IVerificationJobData {
  backupRecordId: string;
  storageKey: string;
}

export interface IRecoveryTestJobData {
  recoveryTestId: string;
  backupRecordId: string;
  testDatabaseName: string;
}
