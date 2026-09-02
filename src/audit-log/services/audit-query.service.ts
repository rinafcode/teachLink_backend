import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AuditLog } from '../audit-log.entity';
import { AuditAction } from '../enums/audit-action.enum';
import { IAuditLogSearchFilters, IAuditLogSearchResult } from '../interfaces/audit-log.interfaces';
import { clampLimit } from '../../common/utils/pagination.utils';

import { PaginationService } from '../../common/services/pagination.service';

const MAX_PAGINATION_LIMIT = 1000;
const DEFAULT_PAGINATION_LIMIT = 100;

function getBoundedTimeWindow(
  startDate?: Date,
  endDate?: Date,
): { startDate: Date; endDate: Date } {
  const end = endDate || new Date();
  const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days default
  return { startDate: start, endDate: end };
}

function clampPagination(skip?: number, take?: number): { skip: number; take: number } {
  const resolvedSkip = skip !== undefined && skip >= 0 ? skip : 0;
  const resolvedTake =
    take !== undefined && take > 0
      ? Math.min(take, MAX_PAGINATION_LIMIT)
      : DEFAULT_PAGINATION_LIMIT;
  return { skip: resolvedSkip, take: resolvedTake };
}

/**
 * Provides audit log query operations.
 * Responsible for searching and retrieving audit logs.
 * Single Responsibility: Querying audit logs from the database.
 */
@Injectable()
export class AuditQueryService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @Optional()
    private readonly paginationService: PaginationService = new PaginationService(),
  ) {}

  /**
   * Search audit logs with filters
   */
  async search(
    filters: IAuditLogSearchFilters,
    page: number = 1,
    limit: number = 50,
    cursor?: string,
    offset?: number,
  ): Promise<IAuditLogSearchResult> {
    const queryBuilder = this.auditRepo.createQueryBuilder('audit');

    // Apply filters
    if (filters.userId) {
      queryBuilder.andWhere('audit.userId = :userId', { userId: filters.userId });
    }

    if (filters.userEmail) {
      queryBuilder.andWhere('audit.userEmail = :userEmail', { userEmail: filters.userEmail });
    }

    if (filters.actions && filters.actions.length > 0) {
      queryBuilder.andWhere('audit.action IN (:...actions)', { actions: filters.actions });
    }

    if (filters.categories && filters.categories.length > 0) {
      queryBuilder.andWhere('audit.category IN (:...categories)', {
        categories: filters.categories,
      });
    }

    if (filters.severities && filters.severities.length > 0) {
      queryBuilder.andWhere('audit.severity IN (:...severities)', {
        severities: filters.severities,
      });
    }

    if (filters.entityType) {
      queryBuilder.andWhere('audit.entityType = :entityType', { entityType: filters.entityType });
    }

    if (filters.entityId) {
      queryBuilder.andWhere('audit.entityId = :entityId', { entityId: filters.entityId });
    }

    if (filters.ipAddress) {
      queryBuilder.andWhere('audit.ipAddress = :ipAddress', { ipAddress: filters.ipAddress });
    }

    if (filters.sessionId) {
      queryBuilder.andWhere('audit.sessionId = :sessionId', { sessionId: filters.sessionId });
    }

    if (filters.tenantId) {
      queryBuilder.andWhere('audit.tenantId = :tenantId', { tenantId: filters.tenantId });
    }

    if (filters.apiEndpoint) {
      queryBuilder.andWhere('audit.apiEndpoint LIKE :apiEndpoint', {
        apiEndpoint: `%${filters.apiEndpoint}%`,
      });
    }

    if (filters.httpMethod) {
      queryBuilder.andWhere('audit.httpMethod = :httpMethod', { httpMethod: filters.httpMethod });
    }

    if (filters.statusCode) {
      queryBuilder.andWhere('audit.statusCode = :statusCode', { statusCode: filters.statusCode });
    }

    if (filters.startDate && filters.endDate) {
      queryBuilder.andWhere('audit.timestamp BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    } else if (filters.startDate) {
      queryBuilder.andWhere('audit.timestamp >= :startDate', { startDate: filters.startDate });
    } else if (filters.endDate) {
      queryBuilder.andWhere('audit.timestamp <= :endDate', { endDate: filters.endDate });
    } else {
      // Default to 30 days if unbounded
      const window = getBoundedTimeWindow();
      queryBuilder.andWhere('audit.timestamp BETWEEN :startDate AND :endDate', {
        startDate: window.startDate,
        endDate: window.endDate,
      });
    }

    const clampedLimit = clampLimit(limit);
    const calculatedOffset = offset ?? (cursor ? undefined : (page - 1) * clampedLimit);

    return this.paginationService.paginate(
      queryBuilder,
      cursor,
      clampedLimit,
      calculatedOffset,
      'timestamp',
    ) as Promise<IAuditLogSearchResult>;
  }

  /**
   * Find all logs (with limit and skip)
   */
  async findAll(
    skip: number = 0,
    limit: number = DEFAULT_PAGINATION_LIMIT,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AuditLog[]> {
    const { skip: clampedSkip, take: clampedTake } = clampPagination(skip, limit);
    const window = getBoundedTimeWindow(startDate, endDate);
    return this.auditRepo.find({
      where: { timestamp: Between(window.startDate, window.endDate) },
      order: { timestamp: 'DESC' },
      skip: clampedSkip,
      take: clampedTake,
    });
  }

  /**
   * Find logs by user
   */
  async findByUser(
    userId: string,
    skip: number = 0,
    limit: number = DEFAULT_PAGINATION_LIMIT,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AuditLog[]> {
    const { skip: clampedSkip, take: clampedTake } = clampPagination(skip, limit);
    const window = getBoundedTimeWindow(startDate, endDate);
    return this.auditRepo.find({
      where: { userId, timestamp: Between(window.startDate, window.endDate) },
      order: { timestamp: 'DESC' },
      skip: clampedSkip,
      take: clampedTake,
    });
  }

  /**
   * Find logs by action
   */
  async findByAction(
    action: AuditAction,
    skip: number = 0,
    limit: number = DEFAULT_PAGINATION_LIMIT,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AuditLog[]> {
    const { skip: clampedSkip, take: clampedTake } = clampPagination(skip, limit);
    const window = getBoundedTimeWindow(startDate, endDate);
    return this.auditRepo.find({
      where: { action, timestamp: Between(window.startDate, window.endDate) },
      order: { timestamp: 'DESC' },
      skip: clampedSkip,
      take: clampedTake,
    });
  }

  /**
   * Find logs by entity
   */
  async findByEntity(
    entityType: string,
    entityId: string,
    skip: number = 0,
    limit: number = DEFAULT_PAGINATION_LIMIT,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AuditLog[]> {
    const { skip: clampedSkip, take: clampedTake } = clampPagination(skip, limit);
    const window = getBoundedTimeWindow(startDate, endDate);
    return this.auditRepo.find({
      where: { entityType, entityId, timestamp: Between(window.startDate, window.endDate) },
      order: { timestamp: 'DESC' },
      skip: clampedSkip,
      take: clampedTake,
    });
  }

  /**
   * Find logs by IP address
   */
  async findByIpAddress(
    ipAddress: string,
    skip: number = 0,
    limit: number = DEFAULT_PAGINATION_LIMIT,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AuditLog[]> {
    const { skip: clampedSkip, take: clampedTake } = clampPagination(skip, limit);
    const window = getBoundedTimeWindow(startDate, endDate);
    return this.auditRepo.find({
      where: { ipAddress, timestamp: Between(window.startDate, window.endDate) },
      order: { timestamp: 'DESC' },
      skip: clampedSkip,
      take: clampedTake,
    });
  }

  /**
   * Find logs by date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    skip: number = 0,
    limit: number = MAX_PAGINATION_LIMIT,
  ): Promise<AuditLog[]> {
    const { skip: clampedSkip, take: clampedTake } = clampPagination(skip, limit);
    const window = getBoundedTimeWindow(startDate, endDate);
    return this.auditRepo.find({
      where: {
        timestamp: Between(window.startDate, window.endDate),
      },
      order: { timestamp: 'DESC' },
      skip: clampedSkip,
      take: clampedTake,
    });
  }

  /**
   * For genuine bulk export needs, provide a streaming export path
   * rather than an unbounded find.
   */
  async streamAll(filters: IAuditLogSearchFilters = {}): Promise<any> {
    const queryBuilder = this.auditRepo.createQueryBuilder('audit');

    if (filters.userId) queryBuilder.andWhere('audit.userId = :userId', { userId: filters.userId });
    if (filters.userEmail)
      queryBuilder.andWhere('audit.userEmail = :userEmail', { userEmail: filters.userEmail });
    if (filters.actions && filters.actions.length > 0)
      queryBuilder.andWhere('audit.action IN (:...actions)', { actions: filters.actions });
    if (filters.categories && filters.categories.length > 0)
      queryBuilder.andWhere('audit.category IN (:...categories)', {
        categories: filters.categories,
      });
    if (filters.severities && filters.severities.length > 0)
      queryBuilder.andWhere('audit.severity IN (:...severities)', {
        severities: filters.severities,
      });
    if (filters.entityType)
      queryBuilder.andWhere('audit.entityType = :entityType', { entityType: filters.entityType });
    if (filters.entityId)
      queryBuilder.andWhere('audit.entityId = :entityId', { entityId: filters.entityId });
    if (filters.ipAddress)
      queryBuilder.andWhere('audit.ipAddress = :ipAddress', { ipAddress: filters.ipAddress });
    if (filters.sessionId)
      queryBuilder.andWhere('audit.sessionId = :sessionId', { sessionId: filters.sessionId });
    if (filters.tenantId)
      queryBuilder.andWhere('audit.tenantId = :tenantId', { tenantId: filters.tenantId });

    if (filters.startDate && filters.endDate) {
      queryBuilder.andWhere('audit.timestamp BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    } else if (filters.startDate) {
      queryBuilder.andWhere('audit.timestamp >= :startDate', { startDate: filters.startDate });
    } else if (filters.endDate) {
      queryBuilder.andWhere('audit.timestamp <= :endDate', { endDate: filters.endDate });
    } else {
      const window = getBoundedTimeWindow();
      queryBuilder.andWhere('audit.timestamp BETWEEN :startDate AND :endDate', {
        startDate: window.startDate,
        endDate: window.endDate,
      });
    }

    queryBuilder.orderBy('audit.timestamp', 'DESC');

    return await queryBuilder.stream();
  }
}
