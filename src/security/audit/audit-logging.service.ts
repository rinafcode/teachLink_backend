import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditLoggingService {
  private logs: any[] = [];

  log(event: string, details: any) {
    this.logs.push({ event, details, timestamp: new Date().toISOString() });
    // In production, write to persistent storage
  }

  getLogs() {
    return this.logs;
  }
}
