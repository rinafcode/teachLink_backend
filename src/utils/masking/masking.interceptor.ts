import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { UserRole } from '../../users/entities/user.entity';
import { applyRoleBasedMasking, USER_MASKING_POLICIES } from './role-visibility.util';
import { MaskingAuditService } from './masking-audit.service';
import { MASK_FIELDS_KEY, FieldMaskConfig } from './mask-fields.decorator';

interface JwtUser {
  userId: string;
  email?: string;
  role?: UserRole;
}

@Injectable()
export class MaskingInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly maskingAuditService: MaskingAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtUser }>();
    const viewer = req.user;

    // No authenticated user — skip masking (auth guard handles access)
    if (!viewer) return next.handle();

    const viewerRole = viewer.role ?? UserRole.STUDENT;

    // Check for explicit @MaskFields decorator on the handler
    const maskConfig = this.reflector.get<FieldMaskConfig | undefined>(
      MASK_FIELDS_KEY,
      context.getHandler(),
    );

    return next
      .handle()
      .pipe(map((data) => this.applyMasking(data, viewerRole, viewer, maskConfig)));
  }

  private applyMasking(
    data: unknown,
    viewerRole: UserRole,
    viewer: JwtUser,
    maskConfig?: FieldMaskConfig,
  ): unknown {
    if (data === null || data === undefined) return data;

    // Handle paginated responses { data: [...], ... }
    if (this.isPaginatedResponse(data)) {
      const paginated = data as { data: unknown[]; [key: string]: unknown };
      return {
        ...paginated,
        data: paginated.data.map((item) =>
          this.maskSingleItem(item, viewerRole, viewer, maskConfig),
        ),
      };
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.maskSingleItem(item, viewerRole, viewer, maskConfig));
    }

    return this.maskSingleItem(data, viewerRole, viewer, maskConfig);
  }

  private maskSingleItem(
    item: unknown,
    viewerRole: UserRole,
    viewer: JwtUser,
    maskConfig?: FieldMaskConfig,
  ): unknown {
    if (!item || typeof item !== 'object') return item;

    const record = item as Record<string, unknown>;

    // Determine which policies to apply
    let policies = USER_MASKING_POLICIES;

    if (maskConfig) {
      // Build a policy from the decorator config
      policies = Object.fromEntries(
        maskConfig.fields.map((field) => [
          field,
          {
            visibleTo: maskConfig.visibleTo,
            mask: USER_MASKING_POLICIES[field]?.mask ?? (() => '[REDACTED]'),
          },
        ]),
      );
    }

    const masked = applyRoleBasedMasking(record, viewerRole, policies);

    // Determine which fields were actually masked
    const maskedFields = Object.keys(policies).filter(
      (field) => field in record && !policies[field].visibleTo.includes(viewerRole),
    );

    if (maskedFields.length > 0 && record['id']) {
      // Fire-and-forget audit log
      void this.maskingAuditService.logMaskedAccess({
        viewerId: viewer.userId,
        viewerEmail: viewer.email,
        viewerRole,
        targetEntityType: 'User',
        targetEntityId: String(record['id']),
        maskedFields,
      });
    }

    return masked;
  }

  private isPaginatedResponse(data: unknown): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      'data' in data &&
      Array.isArray((data as Record<string, unknown>)['data'])
    );
  }
}
