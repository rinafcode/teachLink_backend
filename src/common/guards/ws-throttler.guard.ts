import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { WsException } from '@nestjs/websockets';

/**
 * Protects ws Throttler execution paths.
 */
@Injectable()
export class WsThrottlerGuard extends ThrottlerGuard {
    private readonly wsLogger = new Logger(WsThrottlerGuard.name);
    protected async getTracker(req: Record<string, unknown>): Promise<string> {
        const user = req.user;
        const ip = req.conn?.remoteAddress || req.request?.connection?.remoteAddress || 'unknown';
        return user?.sub || user?.id || ip;
    }
    protected async throwThrottlingException(context: ExecutionContext, _throttlerLimitDetail: ThrottlerLimitDetail): Promise<void> {
        const client = context.switchToWs().getClient();
        const tracker = await this.getTracker(client);
        this.wsLogger.warn(`WebSocket rate limit exceeded for ${tracker}`);
        throw new WsException('Rate limit exceeded');
    }
}
