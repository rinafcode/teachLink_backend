import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { RateLimitingService } from "src/rate-limiting/rate-limiting.service";

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private rateLimiting: RateLimitingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const user = req.user;
    const endpoint = req.route.path;

    await this.rateLimiting.protect(
      user.id,
      user.tier,
      endpoint,
    );

    return true;
  }
}