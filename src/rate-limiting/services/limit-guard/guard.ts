import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RateLimitingService } from '../../rate-limiting.service';

/**
 * Provides rate Limit Guard behavior.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private rateLimiting: RateLimitingService) {}

  /**
   * Executes can Activate.
   * @param context The context.
   * @returns Whether the operation succeeded.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const user = req.user;
    const endpoint = req.route.path;

    await this.rateLimiting.protect(user.id, user.tier, endpoint);

    return true;
  }
}
