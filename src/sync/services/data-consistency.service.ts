import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import { Cron, CronExpression } from "@nestjs/schedule"
import { type IntegrityCheck, CheckType, CheckStatus } from "../entities/integrity-check.entity"
import type { IntegrityCheckResult } from "../interfaces/sync.interfaces"
import { MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';

@Injectable()
export class DataConsistencyService {
  private readonly logger = new Logger(DataConsistencyService.name)

  private readonly integrityCheckRepository: Repository<IntegrityCheck>

  constructor(integrityCheckRepository: Repository<IntegrityCheck>) {
    this.integrityCheckRepository = integrityCheckRepository
  }

  async performConsistencyCheck(
    entityType: string,
    dataSources: string[],
    checkType: CheckType = CheckType.CONSISTENCY,
  ): Promise<IntegrityCheckResult> {
    const startTime = new Date()
    const checkId = await this.createIntegrityCheck(entityType, checkType, dataSources, startTime)

    try {
      let result: IntegrityCheckResult

      switch (checkType) {
        case CheckType.CONSISTENCY:
          result = await this.checkDataConsistency(entityType, dataSources)
          break
        case CheckType.COMPLETENESS:
          result = await this.checkDataCompleteness(entityType, dataSources)
          break
        case CheckType.REFERENTIAL_INTEGRITY:
          result = await this.checkReferentialIntegrity(entityType, dataSources)
          break
        case CheckType.SCHEMA_VALIDATION:
          result = await this.checkSchemaValidation(entityType, dataSources)
          break
        default:
          throw new Error(`Unsupported check type: ${checkType}`)
      }

      // Update integrity check record
      await this.updateIntegrityCheck(checkId, {
        status: result.passed ? CheckStatus.PASSED : CheckStatus.FAILED,
        recordsChecked: result.recordsChecked,
        inconsistenciesFound: result.inconsistencies.length,
        details: {
          errors: result.inconsistencies.map(e => ({ ...e, source: e.sources[0] || 'unknown' })),
          warnings: result.warnings.map(w => ({ entityId: '', message: w, source: 'unknown' })),
        },
        endTime: new Date(),
        durationMs: Date.now() - startTime.getTime(),
      })

      this.logger.log(
        `Consistency check completed for ${entityType}: ${result.recordsChecked} records checked, ${result.inconsistencies.length} inconsistencies found`,
      )

      return result
    } catch (error) {
      await this.updateIntegrityCheck(checkId, {
        status: CheckStatus.FAILED,
        endTime: new Date(),
        durationMs: Date.now() - startTime.getTime(),
      })
      throw error
    }
  }

  async checkDataConsistency(entityType: string, dataSources: string[]): Promise<IntegrityCheckResult> {
    const inconsistencies = []
    const warnings = []
    let recordsChecked = 0

    // Get all entity IDs from primary source
    const primarySource = dataSources[0]
    const entityIds = await this.getEntityIds(entityType, primarySource)

    for (const entityId of entityIds) {
      recordsChecked++

      // Get data from all sources
      const sourceData = new Map<string, any>()
      for (const source of dataSources) {
        try {
          const data = await this.getEntityFromSource(entityType, entityId, source)
          sourceData.set(source, data)
        } catch (error) {
          warnings.push(`Failed to retrieve ${entityId} from ${source}: ${error.message}`)
        }
      }

      // Compare data across sources
      const dataValues = Array.from(sourceData.values())
      if (dataValues.length > 1) {
        const baseData = dataValues[0]
        for (let i = 1; i < dataValues.length; i++) {
          const compareData = dataValues[i]
          const differences = this.compareObjects(baseData, compareData)

          for (const diff of differences) {
            inconsistencies.push({
              entityId,
              field: diff.field,
              expected: diff.value1,
              actual: diff.value2,
              sources: [dataSources[0], dataSources[i]],
            })
          }
        }
      }
    }

    return {
      passed: inconsistencies.length === 0,
      recordsChecked,
      inconsistencies,
      warnings,
    }
  }

  async checkDataCompleteness(entityType: string, dataSources: string[]): Promise<IntegrityCheckResult> {
    const inconsistencies = []
    const warnings = []
    const allEntityIds = new Set<string>()

    // Collect all entity IDs from all sources
    const sourceEntityIds = new Map<string, Set<string>>()
    for (const source of dataSources) {
      try {
        const entityIds = await this.getEntityIds(entityType, source)
        sourceEntityIds.set(source, new Set(entityIds))
        entityIds.forEach((id) => allEntityIds.add(id))
      } catch (error) {
        warnings.push(`Failed to get entity IDs from ${source}: ${error.message}`)
      }
    }

    // Check for missing entities in each source
    for (const entityId of allEntityIds) {
      for (const [source, entityIds] of sourceEntityIds) {
        if (!entityIds.has(entityId)) {
          inconsistencies.push({
            entityId,
            field: "existence",
            expected: "present",
            actual: "missing",
            sources: [source],
          })
        }
      }
    }

    return {
      passed: inconsistencies.length === 0,
      recordsChecked: allEntityIds.size,
      inconsistencies,
      warnings,
    }
  }

  async checkReferentialIntegrity(entityType: string, dataSources: string[]): Promise<IntegrityCheckResult> {
    const inconsistencies = []
    const warnings = []
    let recordsChecked = 0

    // This would implement referential integrity checks
    // For example, checking foreign key constraints across data sources
    const referenceFields = await this.getReferenceFields(entityType)

    for (const source of dataSources) {
      const entityIds = await this.getEntityIds(entityType, source)

      for (const entityId of entityIds) {
        recordsChecked++
        const entity = await this.getEntityFromSource(entityType, entityId, source)

        for (const refField of referenceFields) {
          const refValue = entity[refField.field]
          if (refValue) {
            const refExists = await this.checkReferenceExists(refField.targetEntity, refValue, source)
            if (!refExists) {
              inconsistencies.push({
                entityId,
                field: refField.field,
                expected: "valid reference",
                actual: `dangling reference: ${refValue}`,
                sources: [source],
              })
            }
          }
        }
      }
    }

    return {
      passed: inconsistencies.length === 0,
      recordsChecked,
      inconsistencies,
      warnings,
    }
  }

  async checkSchemaValidation(entityType: string, dataSources: string[]): Promise<IntegrityCheckResult> {
    const inconsistencies = []
    const warnings = []
    let recordsChecked = 0

    const schema = await this.getEntitySchema(entityType)

    for (const source of dataSources) {
      const entityIds = await this.getEntityIds(entityType, source)

      for (const entityId of entityIds) {
        recordsChecked++
        const entity = await this.getEntityFromSource(entityType, entityId, source)

        // Validate against schema
        const validationErrors = this.validateAgainstSchema(entity, schema)
        for (const error of validationErrors) {
          inconsistencies.push({
            entityId,
            field: error.field,
            expected: error.expected,
            actual: error.actual,
            sources: [source],
          })
        }
      }
    }

    return {
      passed: inconsistencies.length === 0,
      recordsChecked,
      inconsistencies,
      warnings,
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async performScheduledConsistencyChecks(): Promise<void> {
    this.logger.log("Starting scheduled consistency checks")

    // Get all registered entity types
    const entityTypes = await this.getRegisteredEntityTypes()

    for (const entityType of entityTypes) {
      try {
        const dataSources = await this.getDataSourcesForEntity(entityType)
        await this.performConsistencyCheck(entityType, dataSources)
      } catch (error) {
        this.logger.error(`Consistency check failed for ${entityType}: ${error.message}`)
      }
    }
  }

  async getConsistencyReport(
    entityType?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalChecks: number
    passedChecks: number
    failedChecks: number
    recentInconsistencies: any[]
  }> {
    const whereCondition: any = {}
    if (entityType) whereCondition.entityType = entityType
    if (startDate && endDate) {
      whereCondition.createdAt = Between(startDate, endDate)
    } else if (startDate) {
      whereCondition.createdAt = MoreThanOrEqual(startDate)
    } else if (endDate) {
      whereCondition.createdAt = LessThanOrEqual(endDate)
    }

    const [totalChecks, passedChecks, failedChecks] = await Promise.all([
      this.integrityCheckRepository.count({ where: whereCondition }),
      this.integrityCheckRepository.count({
        where: { ...whereCondition, status: CheckStatus.PASSED },
      }),
      this.integrityCheckRepository.count({
        where: { ...whereCondition, status: CheckStatus.FAILED },
      }),
    ])

    const recentInconsistencies = await this.integrityCheckRepository.find({
      where: { ...whereCondition, status: CheckStatus.FAILED },
      order: { createdAt: "DESC" },
      take: 10,
    })

    return {
      totalChecks,
      passedChecks,
      failedChecks,
      recentInconsistencies,
    }
  }

  private async createIntegrityCheck(
    entityType: string,
    checkType: CheckType,
    dataSources: string[],
    startTime: Date,
  ): Promise<string> {
    const check = this.integrityCheckRepository.create({
      entityType,
      checkType,
      dataSources,
      status: CheckStatus.RUNNING,
      startTime,
      recordsChecked: 0,
      inconsistenciesFound: 0,
      durationMs: 0,
    })

    const saved = await this.integrityCheckRepository.save(check)
    return saved.id
  }

  private async updateIntegrityCheck(checkId: string, updates: Partial<IntegrityCheck>): Promise<void> {
    await this.integrityCheckRepository.update(checkId, updates)
  }

  private compareObjects(obj1: any, obj2: any, path = ""): Array<{ field: string; value1: any; value2: any }> {
    const differences = []

    const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)])

    for (const key of keys) {
      const currentPath = path ? `${path}.${key}` : key
      const val1 = obj1[key]
      const val2 = obj2[key]

      if (val1 !== val2) {
        if (typeof val1 === "object" && typeof val2 === "object" && val1 !== null && val2 !== null) {
          differences.push(...this.compareObjects(val1, val2, currentPath))
        } else {
          differences.push({
            field: currentPath,
            value1: val1,
            value2: val2,
          })
        }
      }
    }

    return differences
  }

  private async getEntityIds(entityType: string, source: string): Promise<string[]> {
    // Mock implementation - would query actual data source
    return ["entity1", "entity2", "entity3"]
  }

  private async getEntityFromSource(entityType: string, entityId: string, source: string): Promise<any> {
    // Mock implementation - would query actual data source
    return { id: entityId, name: `Entity ${entityId}`, source }
  }

  private async getReferenceFields(entityType: string): Promise<Array<{ field: string; targetEntity: string }>> {
    // Mock implementation - would return actual reference fields
    return [{ field: "userId", targetEntity: "User" }]
  }

  private async checkReferenceExists(entityType: string, entityId: string, source: string): Promise<boolean> {
    // Mock implementation - would check if reference exists
    return true
  }

  private async getEntitySchema(entityType: string): Promise<any> {
    // Mock implementation - would return actual schema
    return {
      id: { type: "string", required: true },
      name: { type: "string", required: true },
      email: { type: "string", required: false },
    }
  }

  private validateAgainstSchema(entity: any, schema: any): Array<{ field: string; expected: any; actual: any }> {
    const errors = []

    for (const [field, rules] of Object.entries(schema)) {
      const value = entity[field]
      const fieldRules = rules as any

      if (fieldRules.required && (value === undefined || value === null)) {
        errors.push({
          field,
          expected: "required value",
          actual: value,
        })
      }

      if (value !== undefined && fieldRules.type && typeof value !== fieldRules.type) {
        errors.push({
          field,
          expected: fieldRules.type,
          actual: typeof value,
        })
      }
    }

    return errors
  }

  private async getRegisteredEntityTypes(): Promise<string[]> {
    // Mock implementation - would return registered entity types
    return ["User", "Product", "Order"]
  }

  private async getDataSourcesForEntity(entityType: string): Promise<string[]> {
    // Mock implementation - would return data sources for entity
    return ["primary_db", "cache", "search_index"]
  }
}
