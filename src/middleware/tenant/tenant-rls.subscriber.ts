import {
  EventSubscriber,
  EntitySubscriberInterface,
  LoadEvent,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from 'typeorm';
import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { IsolationService } from '../../tenancy/isolation/isolation.service';

/**
 * TenantRlsSubscriber enforces row-level security at the ORM layer.
 *
 * - On load: silently filters out rows that don't belong to the current tenant.
 * - On insert/update/remove: throws ForbiddenException if the entity's tenantId
 *   does not match the active tenant context.
 *
 * Only entities that carry a `tenantId` property are affected.
 */
@Injectable()
@EventSubscriber()
export class TenantRlsSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(TenantRlsSubscriber.name);

  constructor(private readonly isolationService: IsolationService) {}

  // Listen to all entities
  listenTo() {
    return Object;
  }

  afterLoad(entity: any, _event?: LoadEvent<any>): void {
    if (!this.hasTenantField(entity)) return;
    if (!this.isolationService.hasTenantContext()) return;

    const currentTenantId = this.isolationService.getTenantId();
    if (entity.tenantId && entity.tenantId !== currentTenantId) {
      this.logger.warn(
        `RLS: blocking access to entity tenantId=${entity.tenantId} for tenant=${currentTenantId}`,
      );
      // Nullify the entity data to prevent leakage
      Object.keys(entity).forEach((key) => {
        if (key !== 'tenantId') delete entity[key];
      });
    }
  }

  beforeInsert(event: InsertEvent<any>): void {
    this.enforceTenant(event.entity, 'insert');
  }

  beforeUpdate(event: UpdateEvent<any>): void {
    this.enforceTenant(event.entity, 'update');
  }

  beforeRemove(event: RemoveEvent<any>): void {
    this.enforceTenant(event.entity, 'remove');
  }

  private enforceTenant(entity: any, operation: string): void {
    if (!entity || !this.hasTenantField(entity)) return;
    if (!this.isolationService.hasTenantContext()) return;

    const currentTenantId = this.isolationService.getTenantId();

    // Auto-assign tenantId on insert if not set
    if (operation === 'insert' && !entity.tenantId) {
      entity.tenantId = currentTenantId;
      return;
    }

    if (entity.tenantId && entity.tenantId !== currentTenantId) {
      this.logger.error(
        `RLS violation on ${operation}: entity tenantId=${entity.tenantId}, current tenant=${currentTenantId}`,
      );
      throw new ForbiddenException('Cross-tenant data access is not allowed');
    }
  }

  private hasTenantField(entity: any): boolean {
    return entity !== null && typeof entity === 'object' && 'tenantId' in entity;
  }
}
