import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import {
  type ConflictLog,
  ConflictType,
  ResolutionStrategy,
  ConflictStatus,
} from "../entities/conflict-log.entity"
import type { ConflictResolutionConfig, ConflictResolutionResult } from "../interfaces/sync.interfaces"

@Injectable()
export class ConflictResolutionService {
  private readonly logger = new Logger(ConflictResolutionService.name)
  private readonly customResolvers = new Map<string, Function>()

  constructor(private readonly conflictLogRepository: Repository<ConflictLog>) {}

  async resolveConflict(
    entityType: string,
    entityId: string,
    conflictingData: Record<string, any>,
    config: ConflictResolutionConfig,
  ): Promise<ConflictResolutionResult> {
    const strategy = config.strategy as ResolutionStrategy;
    const conflictId = await this.logConflict(entityType, entityId, conflictingData, strategy)

    try {
      let result: ConflictResolutionResult

      switch (strategy) {
        case ResolutionStrategy.LAST_WRITE_WINS:
          result = await this.resolveLastWriteWins(conflictingData)
          break
        case ResolutionStrategy.FIRST_WRITE_WINS:
          result = await this.resolveFirstWriteWins(conflictingData)
          break
        case ResolutionStrategy.MERGE:
          result = await this.resolveMerge(conflictingData, config.mergeFields, config.ignoreFields)
          break
        case ResolutionStrategy.CUSTOM:
          result = await this.resolveCustom(entityType, entityId, conflictingData, config.customResolver)
          break
        default:
          throw new Error(`Unsupported resolution strategy: ${strategy}`)
      }

      // Update conflict log
      await this.updateConflictLog(conflictId, {
        status: result.resolved ? ConflictStatus.RESOLVED : ConflictStatus.FAILED,
        resolvedData: result.resolvedData,
        resolutionReason: result.reason,
        resolvedAt: new Date(),
      })

      this.logger.log(`Conflict resolved for ${entityType}:${entityId} using ${config.strategy}: ${result.resolved}`)

      return result
    } catch (error) {
      await this.updateConflictLog(conflictId, {
        status: ConflictStatus.FAILED,
        resolutionReason: error.message,
      })
      throw error
    }
  }

  async detectConflict(
    entityType: string,
    entityId: string,
    newData: Record<string, any>,
    existingData: Record<string, any>,
  ): Promise<ConflictType | null> {
    // Version conflict detection
    if (newData.version && existingData.version && newData.version < existingData.version) {
      return ConflictType.VERSION_CONFLICT
    }

    // Concurrent update detection
    const timeDiff = Math.abs(new Date(newData.updatedAt).getTime() - new Date(existingData.updatedAt).getTime())
    if (timeDiff < 1000) {
      // Updates within 1 second
      return ConflictType.CONCURRENT_UPDATE
    }

    // Data inconsistency detection
    const criticalFields = await this.getCriticalFields(entityType)
    for (const field of criticalFields) {
      if (newData[field] !== existingData[field]) {
        return ConflictType.DATA_INCONSISTENCY
      }
    }

    // Schema mismatch detection
    const newKeys = Object.keys(newData)
    const existingKeys = Object.keys(existingData)
    if (newKeys.length !== existingKeys.length || !newKeys.every((key) => existingKeys.includes(key))) {
      return ConflictType.SCHEMA_MISMATCH
    }

    return null
  }

  async registerCustomResolver(entityType: string, resolver: Function): Promise<void> {
    this.customResolvers.set(entityType, resolver)
    this.logger.log(`Registered custom conflict resolver for entity type: ${entityType}`)
  }

  async getConflictHistory(
    entityType?: string,
    entityId?: string,
    limit = 100,
  ): Promise<{
    conflicts: ConflictLog[]
    summary: {
      total: number
      resolved: number
      failed: number
      byStrategy: Record<string, number>
    }
  }> {
    const whereCondition: any = {}
    if (entityType) whereCondition.entityType = entityType
    if (entityId) whereCondition.entityId = entityId

    const conflicts = await this.conflictLogRepository.find({
      where: whereCondition,
      order: { createdAt: "DESC" },
      take: limit,
    })

    const total = conflicts.length
    const resolved = conflicts.filter((c) => c.status === ConflictStatus.RESOLVED).length
    const failed = conflicts.filter((c) => c.status === ConflictStatus.FAILED).length

    const byStrategy = conflicts.reduce(
      (acc, conflict) => {
        acc[conflict.resolutionStrategy] = (acc[conflict.resolutionStrategy] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return {
      conflicts,
      summary: {
        total,
        resolved,
        failed,
        byStrategy,
      },
    }
  }

  private async resolveLastWriteWins(conflictingData: Record<string, any>): Promise<ConflictResolutionResult> {
    const sources = Object.keys(conflictingData)
    let latestData = conflictingData[sources[0]]
    let latestTimestamp = new Date(latestData.updatedAt || latestData.createdAt)

    for (let i = 1; i < sources.length; i++) {
      const data = conflictingData[sources[i]]
      const timestamp = new Date(data.updatedAt || data.createdAt)

      if (timestamp > latestTimestamp) {
        latestData = data
        latestTimestamp = timestamp
      }
    }

    return {
      resolved: true,
      strategy: ResolutionStrategy.LAST_WRITE_WINS,
      resolvedData: latestData,
      reason: `Selected data with latest timestamp: ${latestTimestamp.toISOString()}`,
    }
  }

  private async resolveFirstWriteWins(conflictingData: Record<string, any>): Promise<ConflictResolutionResult> {
    const sources = Object.keys(conflictingData)
    let earliestData = conflictingData[sources[0]]
    let earliestTimestamp = new Date(earliestData.createdAt)

    for (let i = 1; i < sources.length; i++) {
      const data = conflictingData[sources[i]]
      const timestamp = new Date(data.createdAt)

      if (timestamp < earliestTimestamp) {
        earliestData = data
        earliestTimestamp = timestamp
      }
    }

    return {
      resolved: true,
      strategy: ResolutionStrategy.FIRST_WRITE_WINS,
      resolvedData: earliestData,
      reason: `Selected data with earliest timestamp: ${earliestTimestamp.toISOString()}`,
    }
  }

  private async resolveMerge(
    conflictingData: Record<string, any>,
    mergeFields?: string[],
    ignoreFields?: string[],
  ): Promise<ConflictResolutionResult> {
    const sources = Object.keys(conflictingData)
    const baseData = { ...conflictingData[sources[0]] }

    // Merge strategy: combine non-conflicting fields, use latest for conflicting fields
    for (let i = 1; i < sources.length; i++) {
      const data = conflictingData[sources[i]]

      for (const [key, value] of Object.entries(data)) {
        if (ignoreFields?.includes(key)) continue

        if (mergeFields?.includes(key) || baseData[key] === undefined) {
          baseData[key] = value
        } else if (baseData[key] !== value) {
          // For conflicting fields, use the latest timestamp
          const baseTimestamp = new Date(baseData.updatedAt || baseData.createdAt)
          const dataTimestamp = new Date(data.updatedAt || data.createdAt)

          if (dataTimestamp > baseTimestamp) {
            baseData[key] = value
          }
        }
      }
    }

    return {
      resolved: true,
      strategy: ResolutionStrategy.MERGE,
      resolvedData: baseData,
      reason: "Merged non-conflicting fields and used latest values for conflicts",
    }
  }

  private async resolveCustom(
    entityType: string,
    entityId: string,
    conflictingData: Record<string, any>,
    customResolver?: string,
  ): Promise<ConflictResolutionResult> {
    const resolver = this.customResolvers.get(customResolver || entityType)

    if (!resolver) {
      throw new Error(`No custom resolver found for ${customResolver || entityType}`)
    }

    try {
      const resolvedData = await resolver(entityType, entityId, conflictingData)

      return {
        resolved: true,
        strategy: ResolutionStrategy.CUSTOM,
        resolvedData,
        reason: `Resolved using custom resolver: ${customResolver || entityType}`,
      }
    } catch (error) {
      return {
        resolved: false,
        strategy: ResolutionStrategy.CUSTOM,
        resolvedData: {},
        reason: `Custom resolver failed: ${error.message}`,
      }
    }
  }

  private async logConflict(
    entityType: string,
    entityId: string,
    conflictingData: Record<string, any>,
    strategy: ResolutionStrategy,
  ): Promise<string> {
    const sources = Object.keys(conflictingData)
    const conflictType = await this.determineConflictType(conflictingData)

    const conflict = this.conflictLogRepository.create({
      entityType,
      entityId,
      conflictType,
      resolutionStrategy: strategy,
      status: ConflictStatus.RESOLVING,
      conflictingData: {
        source1: conflictingData[sources[0]],
        source2: conflictingData[sources[1]],
        metadata: {
          totalSources: sources.length,
          detectedAt: new Date(),
        },
      },
      detectedAt: new Date(),
      affectedSources: sources,
    })

    const saved = await this.conflictLogRepository.save(conflict)
    return saved.id
  }

  private async updateConflictLog(conflictId: string, updates: Partial<ConflictLog>): Promise<void> {
    await this.conflictLogRepository.update(conflictId, updates)
  }

  private async determineConflictType(conflictingData: Record<string, any>): Promise<ConflictType> {
    // Simple heuristic to determine conflict type
    const sources = Object.keys(conflictingData)
    const data1 = conflictingData[sources[0]]
    const data2 = conflictingData[sources[1]]

    if (data1.version && data2.version && data1.version !== data2.version) {
      return ConflictType.VERSION_CONFLICT
    }

    const timeDiff = Math.abs(new Date(data1.updatedAt).getTime() - new Date(data2.updatedAt).getTime())
    if (timeDiff < 1000) {
      return ConflictType.CONCURRENT_UPDATE
    }

    return ConflictType.DATA_INCONSISTENCY
  }

  private async getCriticalFields(entityType: string): Promise<string[]> {
    // Mock implementation - would return actual critical fields
    const criticalFieldsMap = {
      User: ["email", "status"],
      Product: ["price", "inventory"],
      Order: ["status", "total"],
    }

    return criticalFieldsMap[entityType] || []
  }
}
