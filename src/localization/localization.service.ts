import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { ListTranslationsQueryDto } from './dto/list-translations-query.dto';
import { TranslationImportRowDto } from './dto/import-translations.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';
import { Translation } from './entities/translation.entity';
import { bundleCacheKey } from './localization.constants';
import { LanguageDetectionService } from './language-detection.service';

export interface TranslationListItemDto {
  id: string;
  namespace: string;
  key: string;
  locale: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedTranslations {
  items: TranslationListItemDto[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class LocalizationService {
  constructor(
    @InjectRepository(Translation)
    private readonly translationRepo: Repository<Translation>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly languageDetection: LanguageDetectionService,
  ) {}

  private getCacheTtlMs(): number {
    const sec = parseInt(this.configService.get<string>('I18N_CACHE_TTL_SECONDS') || '300', 10);
    return Math.max(0, sec) * 1000;
  }

  private getDefaultLocale(): string {
    return this.languageDetection.getDefaultLocale();
  }

  private toItem(entity: Translation): TranslationListItemDto {
    return {
      id: entity.id,
      namespace: entity.namespace,
      key: entity.translationKey,
      locale: entity.locale,
      value: entity.value,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  async invalidateBundles(pairs: Array<{ namespace: string; locale: string }>): Promise<void> {
    const seen = new Set<string>();
    for (const { namespace, locale } of pairs) {
      const k = `${namespace}\0${locale}`;
      if (seen.has(k)) continue;
      seen.add(k);
      await this.cacheManager.del(bundleCacheKey(namespace, locale));
    }
  }

  private async loadRawBundleFromDb(
    namespace: string,
    locale: string,
  ): Promise<Record<string, string>> {
    const rows = await this.translationRepo.find({
      where: { namespace, locale: languageDetectionNormalize(locale) },
      select: ['translationKey', 'value'],
    });
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.translationKey] = r.value;
    }
    return map;
  }

  async getRawBundleCached(namespace: string, locale: string): Promise<Record<string, string>> {
    const loc = languageDetectionNormalize(locale);
    const key = bundleCacheKey(namespace, loc);
    const ttl = this.getCacheTtlMs();
    const cached = await this.cacheManager.get<Record<string, string>>(key);
    if (cached) return cached;
    const fresh = await this.loadRawBundleFromDb(namespace, loc);
    if (ttl > 0) {
      await this.cacheManager.set(key, fresh, ttl);
    } else {
      await this.cacheManager.set(key, fresh);
    }
    return fresh;
  }

  async getMessagesMerged(namespace: string, locale: string): Promise<Record<string, string>> {
    const loc = this.languageDetection.pickSupported(locale) || this.getDefaultLocale();
    const primary = await this.getRawBundleCached(namespace, loc);
    const def = this.getDefaultLocale();
    if (loc === def) {
      return { ...primary };
    }
    const fallback = await this.getRawBundleCached(namespace, def);
    return { ...fallback, ...primary };
  }

  interpolate(template: string, vars?: Record<string, string | number>): string {
    if (!vars) return template;
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
      Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{{${k}}}`,
    );
  }

  async translate(
    namespace: string,
    key: string,
    locale?: string,
    vars?: Record<string, string | number>,
  ): Promise<string> {
    const loc = locale
      ? this.languageDetection.pickSupported(locale) || this.getDefaultLocale()
      : this.getDefaultLocale();
    const merged = await this.getMessagesMerged(namespace, loc);
    const raw = merged[key];
    const text = raw !== undefined && raw !== null && raw !== '' ? raw : `${namespace}.${key}`;
    return this.interpolate(text, vars);
  }

  async getBundleForApi(
    namespace: string,
    locale: string,
  ): Promise<{ locale: string; namespace: string; messages: Record<string, string> }> {
    const loc = this.languageDetection.pickSupported(locale) || this.getDefaultLocale();
    const messages = await this.getMessagesMerged(namespace, loc);
    return { namespace, locale: loc, messages };
  }

  async create(dto: CreateTranslationDto): Promise<TranslationListItemDto> {
    const namespace = dto.namespace.trim();
    const key = dto.key.trim();
    const locale = languageDetectionNormalize(dto.locale);
    const existing = await this.translationRepo.findOne({
      where: { namespace, translationKey: key, locale },
      withDeleted: true,
    });

    if (existing) {
      if (!existing.deletedAt) {
        throw new ConflictException('Translation already exists for this namespace, key, and locale');
      }

      existing.value = dto.value;
      existing.deletedAt = null;

      const restored = await this.translationRepo.save(existing);
      await this.invalidateBundles([{ namespace: restored.namespace, locale: restored.locale }]);
      return this.toItem(restored);
    }

    const entity = this.translationRepo.create({
      namespace,
      translationKey: key,
      locale,
      value: dto.value,
    });
    try {
      const saved = await this.translationRepo.save(entity);
      await this.invalidateBundles([{ namespace: saved.namespace, locale: saved.locale }]);
      return this.toItem(saved);
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException(
          'Translation already exists for this namespace, key, and locale',
        );
      }
      throw e;
    }
  }

  async findAll(query: ListTranslationsQueryDto): Promise<PaginatedTranslations> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.translationRepo.createQueryBuilder('t');
    if (query.namespace) {
      qb.andWhere('t.namespace = :ns', { ns: query.namespace.trim() });
    }
    if (query.locale) {
      qb.andWhere('t.locale = :loc', { loc: languageDetectionNormalize(query.locale) });
    }
    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere('(t.translationKey ILIKE :term OR t.value ILIKE :term)', { term });
    }
    qb.orderBy('t.namespace', 'ASC')
      .addOrderBy('t.locale', 'ASC')
      .addOrderBy('t.translationKey', 'ASC');
    const total = await qb.getCount();
    qb.skip((page - 1) * limit).take(limit);
    const rows = await qb.getMany();
    return {
      items: rows.map((r) => this.toItem(r)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<TranslationListItemDto> {
    const row = await this.translationRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Translation not found');
    return this.toItem(row);
  }

  async update(id: string, dto: UpdateTranslationDto): Promise<TranslationListItemDto> {
    const row = await this.translationRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Translation not found');
    const before = { namespace: row.namespace, locale: row.locale };
    if (dto.namespace !== undefined) row.namespace = dto.namespace.trim();
    if (dto.key !== undefined) row.translationKey = dto.key.trim();
    if (dto.locale !== undefined) row.locale = languageDetectionNormalize(dto.locale);
    if (dto.value !== undefined) row.value = dto.value;
    try {
      const saved = await this.translationRepo.save(row);
      await this.invalidateBundles([before, { namespace: saved.namespace, locale: saved.locale }]);
      return this.toItem(saved);
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException(
          'Translation already exists for this namespace, key, and locale',
        );
      }
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    const row = await this.translationRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Translation not found');
    await this.translationRepo.softRemove(row);
    await this.invalidateBundles([{ namespace: row.namespace, locale: row.locale }]);
  }

  async importRows(rows: TranslationImportRowDto[]): Promise<{ upserted: number }> {
    if (!rows?.length) {
      throw new BadRequestException('Import payload must contain at least one row');
    }

    for (const row of rows) {
      const namespace = row.namespace.trim();
      const translationKey = row.key.trim();
      const locale = languageDetectionNormalize(row.locale);
      const existing = await this.translationRepo.findOne({
        where: { namespace, translationKey, locale },
        withDeleted: true,
      });

      if (existing) {
        existing.value = row.value;
        existing.deletedAt = null;
        await this.translationRepo.save(existing);
        continue;
      }

      await this.translationRepo.save(
        this.translationRepo.create({
          namespace,
          translationKey,
          locale,
          value: row.value,
        }),
      );
    }

    const pairs = rows.map((r) => ({
      namespace: r.namespace.trim(),
      locale: languageDetectionNormalize(r.locale),
    }));
    await this.invalidateBundles(pairs);
    return { upserted: rows.length };
  }

  async exportRows(
    namespace: string,
    locale?: string,
  ): Promise<Array<{ namespace: string; key: string; locale: string; value: string }>> {
    const qb = this.translationRepo
      .createQueryBuilder('t')
      .where('t.namespace = :ns', { ns: namespace.trim() });
    if (locale) {
      qb.andWhere('t.locale = :loc', { loc: languageDetectionNormalize(locale) });
    }
    qb.orderBy('t.locale', 'ASC').addOrderBy('t.translationKey', 'ASC');
    const rows = await qb.getMany();
    return rows.map((r) => ({
      namespace: r.namespace,
      key: r.translationKey,
      locale: r.locale,
      value: r.value,
    }));
  }

  static toCsv(
    rows: Array<{ namespace: string; key: string; locale: string; value: string }>,
  ): string {
    const header = 'namespace,key,locale,value';
    const lines = rows.map((r) =>
      [csvEscape(r.namespace), csvEscape(r.key), csvEscape(r.locale), csvEscape(r.value)].join(','),
    );
    return [header, ...lines].join('\n');
  }
}

function languageDetectionNormalize(locale: string): string {
  return locale.trim().toLowerCase().replace(/_/g, '-');
}

function csvEscape(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err as { driverError?: { code?: string } }).driverError?.code === '23505'
  );
}
