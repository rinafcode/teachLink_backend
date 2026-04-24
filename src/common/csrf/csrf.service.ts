import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

/**
 * Provides csrf operations.
 */
@Injectable()
export class CsrfService {
  private readonly csrfTokens = new Map<string, { token: string; expires: number }>();
  private readonly tokenExpiryTime: number;

  constructor(private configService: ConfigService) {
    this.tokenExpiryTime = this.configService.get<number>('CSRF_TOKEN_EXPIRY', 3600000); // 1 hour default
  }

  /**
   * Generates token.
   * @param sessionId The session identifier.
   * @returns The resulting string value.
   */
  generateToken(sessionId: string): string {
    const token = uuidv4();
    const expires = Date.now() + this.tokenExpiryTime;

    this.csrfTokens.set(sessionId, { token, expires });
    return token;
  }

  /**
   * Validates token.
   * @param sessionId The session identifier.
   * @param token The token value.
   * @returns Whether the operation succeeded.
   */
  validateToken(sessionId: string, token: string): boolean {
    const storedToken = this.csrfTokens.get(sessionId);

    if (!storedToken || storedToken.expires <= Date.now()) {
      return false;
    }

    return storedToken.token === token;
  }

  /**
   * Invalidates token.
   * @param sessionId The session identifier.
   */
  invalidateToken(sessionId: string): void {
    this.csrfTokens.delete(sessionId);
  }

  /**
   * Retrieves token.
   * @param sessionId The session identifier.
   * @returns The operation result.
   */
  getToken(sessionId: string): string | null {
    const storedToken = this.csrfTokens.get(sessionId);

    if (!storedToken || storedToken.expires <= Date.now()) {
      return null;
    }

    return storedToken.token;
  }

  /**
   * Executes cleanup Expired Tokens.
   */
  cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [sessionId, tokenData] of this.csrfTokens.entries()) {
      if (tokenData.expires <= now) {
        this.csrfTokens.delete(sessionId);
      }
    }
  }
}
