import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AuditLog } from '../audit-log.entity';
import { AuditAction } from '../enums/audit-action.enum';
import { IAuditLogSearchFilters, IAuditLogSearchResult } from '../interfaces/audit-log.interfaces';
import { clampLimit } from '../../common/utils/pagination.utils';

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
  ) {}

  /**
   * Search audit logs with filters
   */
  async search(
    filters: IAuditLogSearchFilters,
    page: number = 1,
    limit: number = 50,
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
    }

    queryBuilder.orderBy('audit.timestamp', 'DESC');

    const total = await queryBuilder.getCount();
    const clampedLimit = clampLimit(limit);
    const skip = (page - 1) * clampedLimit;
    queryBuilder.skip(skip).take(clampedLimit);
    const data = await queryBuilder.getMany();
    const totalPages = Math.ceil(total / clampedLimit);

    return {
      data,
      total,
      page,
      limit: clampedLimit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  /**
   * Find all logs (with limit)
   */
  async findAll(limit: number = 100): Promise<AuditLog[]> {
    return this.auditRepo.find({
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Find logs by user
   */
  async findByUser(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Find logs by action
   */
  async findByAction(action: AuditAction, limit: number = 100): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { action },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Find logs by entity
   */
  async findByEntity(
    entityType: string,
    entityId: string,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { entityType, entityId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Find logs by IP address
   */
  async findByIpAddress(ipAddress: string, limit: number = 100): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { ipAddress },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Find logs by date range
   */
  async findByDateRange(startDate: Date, endDate: Date, limit: number = 1000): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: {
        timestamp: Between(startDate, endDate),
      },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }
}
