import { Injectable } from '@nestjs/common';
import { CachingService } from '../../caching/caching.service';

@Injectable()
export class TokenBlacklistService {
  constructor(private readonly cachingService: CachingService) {}

  /**
   * Adds a token JTI to the Redis blacklist.
   * @param jti The JWT ID.
   * @param expiresInMs The remaining time to live for the token in milliseconds.
   */
  async addToBlacklist(jti: string, expiresInMs: number): Promise<void> {
    const ttlSeconds = Math.ceil(expiresInMs / 1000);
    // Use the caching service to store the blacklisted token
    await this.cachingService.set(`bl_token:${jti}`, 'revoked', ttlSeconds);
  }

  /**
   * Checks if a token JTI is blacklisted.
   * @param jti The JWT ID.
   * @returns True if the token is blacklisted, false otherwise.
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    const result = await this.cachingService.get<string>(`bl_token:${jti}`);
    return result === 'revoked';
  }
}
