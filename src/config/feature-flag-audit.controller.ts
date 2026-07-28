import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Patch,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { IFeatureFlagsConfig } from './feature-flags.config';
import { FlagAuditEntry, FeatureFlagAuditService } from './feature-flag-audit.service';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role?: string;
    roles?: string[];
  };
}

interface ToggleFlagDto {
  value: boolean;
}

/**
 * Admin-only endpoints for querying and toggling feature flags with audit trails.
 *
 * All routes require an authenticated admin user.  Role enforcement is done
 * inside the handler so that it works regardless of which auth guard is in use.
 */
@Controller('feature-flags')
export class FeatureFlagAuditController {
  private readonly logger = new Logger(FeatureFlagAuditController.name);

  constructor(private readonly auditService: FeatureFlagAuditService) {}

  /**
   * GET /feature-flags/audit
   *
   * Returns the last 100 feature flag state changes for compliance review.
   * Access restricted to admin users.
   */
  @Get('audit')
  getAuditLog(@Req() req: AuthenticatedRequest): FlagAuditEntry[] {
    this.assertAdmin(req);
    return this.auditService.getAuditHistory();
  }

  /**
   * GET /feature-flags
   *
   * Returns a snapshot of all current flag values.
   */
  @Get()
  getFlags(@Req() req: AuthenticatedRequest): Record<string, boolean> {
    this.assertAdmin(req);
    return this.auditService.getAllFlags();
  }

  /**
   * PATCH /feature-flags/:key
   *
   * Toggles a single flag at runtime and records the change in the audit log.
   *
   * @param key   - Flag key from {@link IFeatureFlagsConfig} (e.g. `ENABLE_AUTH`).
   * @param body  - `{ value: boolean }` — desired new state.
   */
  @Patch(':key')
  async toggleFlag(
    @Param('key') key: string,
    @Body() body: ToggleFlagDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<FlagAuditEntry> {
    this.assertAdmin(req);

    const user = req.user!;
    const entry = await this.auditService.setFlag(key as keyof IFeatureFlagsConfig, body.value, {
      id: user.userId,
      email: user.email,
    });

    this.logger.log(`Admin ${user.email} toggled ${key} → ${String(body.value)}`);

    return entry;
  }

  private assertAdmin(req: AuthenticatedRequest): void {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Authentication required.');
    }
    const roles: string[] = user.roles ?? (user.role ? [user.role] : []);
    if (!roles.includes('admin')) {
      throw new ForbiddenException('Only admins may access feature flag management.');
    }
  }
}
