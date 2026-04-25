import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
@Injectable()
export class CsrfService {
    private readonly csrfTokens = new Map<string, {
        token: string;
        expires: number;
    }>();
    private readonly tokenExpiryTime: number;
    constructor(private configService: ConfigService) {
        this.tokenExpiryTime = this.configService.get<number>('CSRF_TOKEN_EXPIRY', 3600000); // 1 hour default
    }
    generateToken(sessionId: string): string {
        const token = uuidv4();
        const expires = Date.now() + this.tokenExpiryTime;
        this.csrfTokens.set(sessionId, { token, expires });
        return token;
    }
    validateToken(sessionId: string, token: string): boolean {
        const storedToken = this.csrfTokens.get(sessionId);
        if (!storedToken || storedToken.expires <= Date.now()) {
            return false;
        }
        return storedToken.token === token;
    }
    invalidateToken(sessionId: string): void {
        this.csrfTokens.delete(sessionId);
    }
    getToken(sessionId: string): string | null {
        const storedToken = this.csrfTokens.get(sessionId);
        if (!storedToken || storedToken.expires <= Date.now()) {
            return null;
        }
        return storedToken.token;
    }
    cleanupExpiredTokens(): void {
        const now = Date.now();
        for (const [sessionId, tokenData] of this.csrfTokens.entries()) {
            if (tokenData.expires <= now) {
                this.csrfTokens.delete(sessionId);
            }
        }
    }
}
