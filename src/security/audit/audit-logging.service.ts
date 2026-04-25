import { Injectable, Logger } from '@nestjs/common';
@Injectable()
export class AuditLoggingService {
    private readonly logger = new Logger(AuditLoggingService.name);
    log(event: string, data: Record<string, unknown>): void {
        this.logger.log(JSON.stringify({
            event,
            data,
            timestamp: new Date().toISOString(),
        }));
    }
    logLogin(userId: string): void {
        this.log('USER_LOGIN', { userId });
    }
    logDataAccess(userId: string, resource: string): void {
        this.log('DATA_ACCESS', { userId, resource });
    }
    logDeletion(userId: string, resource: string): void {
        this.log('DATA_DELETION', { userId, resource });
    }
}
