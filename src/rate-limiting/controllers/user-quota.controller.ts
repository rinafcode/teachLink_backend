import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { QuotaManagementService } from '../services/quota.service';
import { QuotaStatusDto } from '../dto/quota.dto';
import { SkipQuota } from '../decorators/quota.decorator';
import { UserTier } from '../rate-limiting.constants';

@ApiTags('Quota')
@SkipQuota()
@Controller('quota')
export class UserQuotaController {
  constructor(private readonly quotas: QuotaManagementService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current quota usage for the caller' })
  @ApiResponse({ status: 200, type: QuotaStatusDto })
  getStatus(@Req() req: Request & { user?: Record<string, unknown> }): Promise<QuotaStatusDto> {
    const userId = this.resolveUserId(req);
    const tier = this.resolveTier(req.user);
    return this.quotas.getStatus(userId, tier);
  }

  private resolveUserId(req: Request & { user?: Record<string, unknown> }): string {
    const user = req.user;
    if (user?.id) return String(user.id);
    if (user?.sub) return String(user.sub);

    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return `ip:${forwarded.split(',')[0].trim()}`;
    }
    return `ip:${req.ip ?? req.socket?.remoteAddress ?? 'unknown'}`;
  }

  private resolveTier(user?: Record<string, unknown>): UserTier {
    if (!user) return UserTier.FREE;
    const raw = String(user.tier ?? user.plan ?? 'FREE').toUpperCase();
    return (UserTier[raw as keyof typeof UserTier] as UserTier | undefined) ?? UserTier.FREE;
  }
}
