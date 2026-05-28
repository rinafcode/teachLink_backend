import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuotaDefinition } from '../entities/quota-definition.entity';
import { QUOTA_LIMITS, UserTier } from '../rate-limiting.constants';
import { CreateQuotaDefinitionDto, UpdateQuotaDefinitionDto } from '../dto/quota.dto';

/**
 * Manages quota rule definitions (CRUD).
 * Seeded from QUOTA_LIMITS constants on first boot; overrideable via admin API.
 */
@Injectable()
export class QuotaDefinitionService {
  private readonly logger = new Logger(QuotaDefinitionService.name);

  constructor(
    @InjectRepository(QuotaDefinition)
    private readonly repo: Repository<QuotaDefinition>,
  ) {}

  /** Seed default tier quotas if not already present. Called from module onModuleInit. */
  async seedDefaults(): Promise<void> {
    for (const tier of Object.values(UserTier)) {
      const exists = await this.repo.findOne({
        where: { tier, userId: null, isActive: true },
      });
      if (!exists) {
        const limits = QUOTA_LIMITS[tier];
        await this.repo.save(this.repo.create({ tier, userId: null, ...limits, isActive: true }));
        this.logger.log(`Seeded default quota for tier ${tier}`);
      }
    }
  }

  async create(dto: CreateQuotaDefinitionDto): Promise<QuotaDefinition> {
    const definition = this.repo.create({
      tier: dto.tier ?? null,
      userId: dto.userId ?? null,
      requestsPerMinute: dto.requestsPerMinute,
      requestsPerHour: dto.requestsPerHour,
      requestsPerDay: dto.requestsPerDay,
      isActive: true,
    });
    return this.repo.save(definition);
  }

  async findAll(): Promise<QuotaDefinition[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<QuotaDefinition> {
    const def = await this.repo.findOne({ where: { id } });
    if (!def) throw new NotFoundException(`Quota definition ${id} not found`);
    return def;
  }

  async update(id: string, dto: UpdateQuotaDefinitionDto): Promise<QuotaDefinition> {
    const def = await this.findOne(id);
    Object.assign(def, dto);
    return this.repo.save(def);
  }

  async remove(id: string): Promise<void> {
    const def = await this.findOne(id);
    await this.repo.remove(def);
  }

  /**
   * Resolve the effective quota for a user.
   * Priority: per-user override > tier rule > hardcoded constant fallback.
   */
  async resolveForUser(
    userId: string,
    tier: UserTier,
  ): Promise<{ requestsPerMinute: number; requestsPerHour: number; requestsPerDay: number }> {
    // 1. Per-user override
    const userOverride = await this.repo.findOne({
      where: { userId, isActive: true },
    });
    if (userOverride) return userOverride;

    // 2. Tier-level rule from DB
    const tierRule = await this.repo.findOne({
      where: { tier, userId: null, isActive: true },
    });
    if (tierRule) return tierRule;

    // 3. Fallback to in-memory constants
    return QUOTA_LIMITS[tier] ?? QUOTA_LIMITS[UserTier.FREE];
  }
}
