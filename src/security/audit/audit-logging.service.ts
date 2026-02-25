import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditLoggingService {
  log(event: string, data: Record<string, any>) {
    console.log(
      JSON.stringify({
        event,
        data,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  logLogin(userId: string) {
    this.log('USER_LOGIN', { userId });
  }

  logDataAccess(userId: string, resource: string) {
    this.log('DATA_ACCESS', { userId, resource });
  }

  logDeletion(userId: string, resource: string) {
    this.log('DATA_DELETION', { userId, resource });
  }
}
