import {
  EventSubscriber,
  EntitySubscriberInterface,
  LoadEvent,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { ForbiddenOperationException } from '../../common/exceptions/app.exceptions';
import { IsolationService } from '../../../tenancy/isolation/isolation.service';

/**
 * TenantRlsSubscriber enforces row-level security at the ORM layer.
 *
 * - On load: refuses loading entities that don't belong to the current tenant.
 * - On insert/update/remove: throws if the entity's tenantId does not
 *   match the active tenant context, or if the tenant context is missing.
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

    if (!this.isolationService.hasTenantContext()) {
      this.logger.error(
        'RLS: loaded tenant-scoped entity without an active tenant context; refusing to return data',
      );
      throw new ForbiddenOperationException('Tenant context is required for tenant-scoped data');
    }

    const currentTenantId = this.isolationService.getTenantId();
    if (entity.tenantId && entity.tenantId !== currentTenantId) {
      this.logger.warn(
        `RLS: blocking access to entity tenantId=${entity.tenantId} for tenant=${currentTenantId}`,
      );
      throw new ForbiddenOperationException('Cross-tenant data access is not allowed');
    }
  }

  beforeInsert(event: InsertEvent<any>): void {
    const entity = event.entity;
    if (!this.hasTenantField(entity)) return;

    if (!this.isolationService.hasTenantContext()) {
      this.logger.error('RLS: insert attempted without an active tenant context');
      throw new ForbiddenOperationException('Tenant context is required for tenant-scoped entities');
    }

    const currentTenantId = this.isolationService.getTenantId();
    if (entity.tenantId && entity.tenantId !== currentTenantId) {
      this.logger.error(
        `RLS violation on insert: entity tenantId=${entity.tenantId}, current tenant=${currentTenantId}`,
      );
      throw new ForbiddenOperationException('Cross-tenant data access is not allowed');
    }

    if (!entity.tenantId) {
      entity.tenantId = currentTenantId;
    }
  }

  beforeUpdate(event: UpdateEvent<any>): void {
    const { entity, metadata } = event;
    const isTenantScoped = this.isTenantScoped(metadata);

    if (entity) {
      if (!this.hasTenantField(entity)) {
        if (isTenantScoped) {
          this.requireTenantContext('update');
        }
        return;
      }
      this.requireTenantContext('update');
      this.assertTenantMatch(entity, 'update');
      return;
    }

    // Bulk update via QueryBuilder or repository.update()
    if (isTenantScoped) {
      this.requireTenantContext('update');
      // RLS will enforce tenant-scoping at the database level; no entity to inspect.
    }
  }

  beforeRemove(event: RemoveEvent<any>): void {
    const { entity, metadata } = event;
    const isTenantScoped = this.isTenantScoped(metadata);

    if (entity) {
      if (!this.hasTenantField(entity)) {
        if (isTenantScoped) {
          this.requireTenantContext('remove');
        }
        return;
      }
      this.requireTenantContext('remove');
      this.assertTenantMatch(entity, 'remove');
      return;
    }

    // Bulk delete via QueryBuilder or repository.delete()
    if (isTenantScoped) {
      this.requireTenantContext('remove');
      // RLS will enforce tenant-scoping at the database level; no entity to inspect.
    }
  }

  private requireTenantContext(operation: string): void {
    if (!this.isolationService.hasTenantContext()) {
      this.logger.error(`RLS: ${operation} attempted without an active tenant context`);
      throw new ForbiddenOperationException(
        `Tenant context is required for tenant-scoped ${operation} operations',
      );
    }
  }

  private assertTenantMatch(entity: any, operation: string): void {
    const currentTenantId = this.isolationService.getTenantId();
    if (entity.tenantId && entity.tenantId !== currentTenantId) {
      this.logger.error(
        `RLS violation on ${operation}: entity tenantId=${entity.tenantId}, current tenant=${currentTenantId}`,
      );
      throw new ForbiddenOperationException('Cross-tenant data access is not allowed');
    }
  }

  private isTenantScoped(metadata?: { hasColumnWithPropertyPath?: (path: string) => boolean }): boolean {
    return !!metadata && typeof metadata.hasColumnWithPropertyPath === 'function'
      ? metadata.hasColumnPropertyPath('tenantId')
      : false;
  }

  private hasTenantField(entity: any): boolean {
    return entity !== null && typeof entity === 'object' && 'tenantId' in entity;
  }
}
