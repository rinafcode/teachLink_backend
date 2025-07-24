import { Injectable } from '@nestjs/common';
import { RateLimitingService } from '../../rate-limiting/rate-limiting.service';

@Injectable()
export class PolicyEnforcementService {
  constructor(private readonly rateLimitingService: RateLimitingService) {}

  /**
   * Enforces rate limiting and other policies. Returns true if allowed, false otherwise.
   */
  async enforcePolicies(request: any): Promise<boolean> {
    // Use userId from JWT if available, otherwise fallback to IP
    const userId = request.user?.sub || null;
    const tier = request.user?.role || 'free';
    const endpoint = request.path;
    const ip = request.ip || request.headers['x-forwarded-for'] || request.connection.remoteAddress;
    // Use rate limiting service
    return this.rateLimitingService.isAllowed(userId || ip, tier, endpoint, ip);
  }
} 